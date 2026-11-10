import {
  BaseError,
  ContractFunctionRevertedError,
  encodeFunctionData,
  getAbiItem,
  isAddressEqual,
  parseEventLogs,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
} from 'viem'
import { successfulReceipt } from './actions.ts'
import { MULTICALL3 } from './config.ts'
import type { Wallet } from './create2.ts'
import { forwarderAbi, payoutTriggerAbi, vaultAbi } from './generated/kinds/lido-wsteth-v1.ts'
import { getLogsChunked } from './logs.ts'

const multicall3Abi = [
  {
    type: 'function',
    name: 'aggregate3',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
] as const

/// A transfer to the treasury. `amount` is the vault shares redeemed, which are stETH value (≈ ETH), the unit
/// every other figure uses; `assets` is the wstETH the treasury received.
export type Payout = { blockNumber: bigint; txHash: Hex; forwarder: Address; receiver: Address; amount: bigint; assets: bigint }

const yieldForwarded = getAbiItem({ abi: forwarderAbi, name: 'YieldForwarded' })
const updateDragonRouter = getAbiItem({ abi: vaultAbi, name: 'UpdateDragonRouter' })

/// Payout history: what the vault's forwarders actually sent to the treasury, from their YieldForwarded events.
/// Minting yield to the forwarder (DonationMinted) isn't a payout: the shares can wait there, and a loss can
/// burn them. The forwarders are `forwarder` and any the vault switched to since, from the vault's own
/// events, so the history survives a forwarder replacement. Anyone can make a forwarder emit YieldForwarded
/// for a made-up strategy, so only events naming this vault count. Shares sent with `forwardToken` (a manual
/// workaround) aren't included.
export async function payoutHistory(
  client: PublicClient,
  vault: Address,
  forwarder: Address | undefined,
  fromBlock: bigint,
): Promise<Payout[]> {
  const changes = await getLogsChunked(client, { address: vault, event: updateDragonRouter, fromBlock })
  const forwarders = [...new Set([forwarder, ...changes.map((log) => log.args.newDragonRouter)].filter((a) => a !== undefined))]
  if (forwarders.length === 0) return []
  const logs = await getLogsChunked(client, { address: forwarders, event: yieldForwarded, args: { strategy: vault }, fromBlock })
  return logs
    .filter((log) => isAddressEqual(log.args.strategy!, vault))
    .map((log) => ({
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      forwarder: log.address,
      receiver: log.args.receiver!,
      amount: log.args.shares!,
      assets: log.args.assets!,
    }))
}

export type PayoutPreview =
  | { status: 'ready'; assets: bigint }
  | { status: 'nothing' }
  | { status: 'no-deposits' }
  | { status: 'paused-loss' }
  | { status: 'error'; message: string }

function revertReason(error: unknown): string | undefined {
  if (!(error instanceof BaseError)) return undefined
  const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
  return revert instanceof ContractFunctionRevertedError ? revert.reason : undefined
}

/// What "Send payout" would do right now, from a simulation as `account`.
export async function previewPayout(
  client: PublicClient,
  account: Address,
  trigger: Address,
  forwarder: Address,
  vault: Address,
): Promise<PayoutPreview> {
  try {
    const { result } = await client.simulateContract({
      account,
      address: trigger,
      abi: payoutTriggerAbi,
      functionName: 'sendPayout',
      args: [forwarder, vault],
    })
    return result > 0n ? { status: 'ready', assets: result } : { status: 'nothing' }
  } catch (error) {
    const reason = revertReason(error)
    if (reason === '!profit') return { status: 'no-deposits' }
    if (reason === '!loss') return { status: 'paused-loss' }
    return { status: 'error', message: reason ?? (error instanceof BaseError ? error.shortMessage : String(error)) }
  }
}

type Target = { trigger: Address; forwarder: Address; vault: Address }

/// The wstETH a payout transaction sent from `forwarder` for `vault`, from its YieldForwarded log; 0n when
/// it sent nothing. Anyone can make a forwarder emit YieldForwarded for a made-up strategy, so only a log
/// naming the vault counts.
export function forwardedIn(logs: Log[], { forwarder, vault }: Pick<Target, 'forwarder' | 'vault'>): bigint {
  const log = parseEventLogs({ abi: forwarderAbi, eventName: 'YieldForwarded', logs }).find(
    (l) => isAddressEqual(l.address, forwarder) && isAddressEqual(l.args.strategy, vault),
  )
  return log?.args.assets ?? 0n
}

/// `assets` is the wstETH sent to the treasury: 0n if there was nothing to send by the time it was mined.
export async function sendPayout(
  client: PublicClient,
  wallet: Wallet,
  trigger: Address,
  forwarder: Address,
  vault: Address,
): Promise<{ hash: Hex; assets: bigint }> {
  const hash = await wallet.writeContract({
    address: trigger,
    abi: payoutTriggerAbi,
    functionName: 'sendPayout',
    args: [forwarder, vault],
  })
  const receipt = await successfulReceipt(client, hash, 'Payout')
  return { hash, assets: forwardedIn(receipt.logs, { forwarder, vault }) }
}

function payoutCall({ trigger, forwarder, vault }: Target) {
  return {
    target: trigger,
    allowFailure: true,
    callData: encodeFunctionData({ abi: payoutTriggerAbi, functionName: 'sendPayout', args: [forwarder, vault] }),
  }
}

/// Every payout in one Multicall3 transaction; a vault with nothing to send doesn't stop the rest. The
/// transaction succeeds even when single payouts fail, so `sent` and `missed` say which went through.
export async function sendAllPayouts<T extends Target>(
  client: PublicClient,
  wallet: Wallet,
  targets: T[],
): Promise<{ hash: Hex; sent: T[]; missed: T[] }> {
  const hash = await wallet.writeContract({
    address: MULTICALL3,
    abi: multicall3Abi,
    functionName: 'aggregate3',
    args: [targets.map(payoutCall)],
  })
  const receipt = await successfulReceipt(client, hash, 'Payouts')
  const went = targets.map((t) => forwardedIn(receipt.logs, t) > 0n)
  return { hash, sent: targets.filter((_, i) => went[i]), missed: targets.filter((_, i) => !went[i]) }
}
