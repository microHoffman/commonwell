import {
  BaseError,
  ContractFunctionRevertedError,
  encodeFunctionData,
  getAbiItem,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { MULTICALL3 } from './config.ts'
import type { Wallet } from './create2.ts'
import { payoutTriggerAbi, vaultAbi } from './generated/kinds/lido-wsteth-v1.ts'
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

export type Payout = { blockNumber: bigint; txHash: Hex; dragonRouter: Address; amount: bigint; exchangeRate: bigint }

const donationMinted = getAbiItem({ abi: vaultAbi, name: 'DonationMinted' })

/// Payout history from the vault's own DonationMinted events. Only the vault can emit them, so the
/// history survives a forwarder replacement and can't be faked through the forwarder.
/// `amount` is the donation's stETH value (≈ ETH).
export async function payoutHistory(client: PublicClient, vault: Address, fromBlock: bigint): Promise<Payout[]> {
  const logs = await getLogsChunked(client, { address: vault, event: donationMinted, fromBlock })
  return logs.map((log) => ({
    blockNumber: log.blockNumber,
    txHash: log.transactionHash,
    dragonRouter: log.args.dragonRouter as Address,
    amount: log.args.amount as bigint,
    exchangeRate: log.args.exchangeRate as bigint,
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

export async function sendPayout(client: PublicClient, wallet: Wallet, trigger: Address, forwarder: Address, vault: Address): Promise<Hex> {
  const hash = await wallet.writeContract({
    address: trigger,
    abi: payoutTriggerAbi,
    functionName: 'sendPayout',
    args: [forwarder, vault],
  })
  await client.waitForTransactionReceipt({ hash })
  return hash
}

type Target = { trigger: Address; forwarder: Address; vault: Address }

function payoutCall({ trigger, forwarder, vault }: Target) {
  return {
    target: trigger,
    allowFailure: true,
    callData: encodeFunctionData({ abi: payoutTriggerAbi, functionName: 'sendPayout', args: [forwarder, vault] }),
  }
}

/// Every payout in one Multicall3 transaction; a vault with nothing to send doesn't stop the rest.
export async function sendAllPayouts(client: PublicClient, wallet: Wallet, targets: Target[]): Promise<Hex> {
  const hash = await wallet.writeContract({
    address: MULTICALL3,
    abi: multicall3Abi,
    functionName: 'aggregate3',
    args: [targets.map(payoutCall)],
  })
  await client.waitForTransactionReceipt({ hash })
  return hash
}
