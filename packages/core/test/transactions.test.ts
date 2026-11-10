import { describe, expect, test } from 'bun:test'
import { encodeAbiParameters, encodeEventTopics, pad, type Address, type Hex, type Log, type PublicClient } from 'viem'
import {
  approve,
  forwarderAbi,
  forwardedIn,
  payoutHistory,
  redeemAll,
  sendAllPayouts,
  sendPayout,
  withdraw,
  type Wallet,
} from '../src/index.ts'

const hash = pad('0xabc', { size: 32 })
const user = pad('0x1', { size: 20 })
const treasury = pad('0x2', { size: 20 })
const trigger = pad('0x3', { size: 20 })
const vaultA = pad('0xa1', { size: 20 })
const vaultB = pad('0xb1', { size: 20 })
const forwarderA = pad('0xa2', { size: 20 })
const forwarderB = pad('0xb2', { size: 20 })

function client(status: 'success' | 'reverted', logs: Log[] = []): PublicClient {
  return {
    waitForTransactionReceipt: async () => ({ status, logs, transactionHash: hash }),
    estimateContractGas: async () => 300_000n,
  } as unknown as PublicClient
}

const wallet = { account: { address: user }, writeContract: async () => hash } as unknown as Wallet

/// A YieldForwarded log as `forwarder` emits it for `strategy`.
function forwarded(forwarder: Address, strategy: Address, assets: bigint): Log {
  return {
    address: forwarder,
    topics: encodeEventTopics({ abi: forwarderAbi, eventName: 'YieldForwarded', args: { strategy, receiver: treasury } }) as [Hex, ...Hex[]],
    data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [assets, assets]),
    blockHash: hash,
    blockNumber: 1n,
    logIndex: 0,
    transactionHash: hash,
    transactionIndex: 0,
    removed: false,
  }
}

describe('a reverted transaction never reads as success', () => {
  const reverted = client('reverted')
  test('approve', () => expect(approve(reverted, wallet, vaultA, trigger, 1n)).rejects.toThrow('Approval failed'))
  test('partial withdrawal', () => expect(withdraw(reverted, wallet, vaultA, 1n)).rejects.toThrow('Withdrawal failed'))
  test('full withdrawal', () => expect(redeemAll(reverted, wallet, vaultA, 1n)).rejects.toThrow('Withdrawal failed'))
  test('single payout', () => expect(sendPayout(reverted, wallet, trigger, forwarderA, vaultA)).rejects.toThrow('Payout failed'))
  test('batch payout', () =>
    expect(sendAllPayouts(reverted, wallet, [{ trigger, forwarder: forwarderA, vault: vaultA }])).rejects.toThrow('Payouts failed'))
})

describe('payout outcomes come from the forwarder logs', () => {
  test('a payout reports what its forwarder sent', async () => {
    const result = await sendPayout(client('success', [forwarded(forwarderA, vaultA, 5n)]), wallet, trigger, forwarderA, vaultA)
    expect(result).toEqual({ hash, assets: 5n })
  })

  test('a payout that found nothing to send reports 0', async () => {
    expect((await sendPayout(client('success'), wallet, trigger, forwarderA, vaultA)).assets).toBe(0n)
  })

  test('a forwarder event for another strategy or from another address does not count', () => {
    const junk = [forwarded(forwarderA, pad('0xdead', { size: 20 }), 9n), forwarded(pad('0xdead', { size: 20 }), vaultA, 9n)]
    expect(forwardedIn(junk, { forwarder: forwarderA, vault: vaultA })).toBe(0n)
  })

  test('a batch gets enough gas for every payout inside it, not just for itself', async () => {
    const sent: { gas?: bigint }[] = []
    const recording = { ...wallet, writeContract: async (args: { gas?: bigint }) => (sent.push(args), hash) } as unknown as Wallet
    const targets = [
      { trigger, forwarder: forwarderA, vault: vaultA },
      { trigger, forwarder: forwarderB, vault: vaultB },
    ]
    await sendAllPayouts(client('success'), recording, targets)
    // Two payouts at 300k each, plus headroom.
    expect(sent[0]!.gas).toBe((600_000n * 5n) / 4n + 50_000n)
  })

  test('a batch splits payouts that went through from those that did not', async () => {
    const a = { name: 'A', trigger, forwarder: forwarderA, vault: vaultA }
    const b = { name: 'B', trigger, forwarder: forwarderB, vault: vaultB }
    // B's call failed inside the batch; a junk event names B's vault from A's forwarder.
    const logs = [forwarded(forwarderA, vaultA, 3n), forwarded(forwarderA, vaultB, 1n)]
    const result = await sendAllPayouts(client('success', logs), wallet, [a, b])
    expect(result.sent).toEqual([a])
    expect(result.missed).toEqual([b])
  })
})

describe('payout history', () => {
  // A decoded YieldForwarded log as getLogs returns it.
  const sent = (forwarder: Address, strategy: Address, shares: bigint, assets: bigint) => ({
    address: forwarder,
    blockNumber: 7n,
    transactionHash: hash,
    args: { strategy, receiver: treasury, shares, assets },
  })

  test('lists what every forwarder the vault used sent for it, in ETH value', async () => {
    const queries: { address: unknown; args: unknown }[] = []
    const stub = {
      getBlockNumber: async () => 10n,
      getLogs: async (params: { event: { name: string }; address: unknown; args: unknown }) => {
        if (params.event.name === 'UpdateDragonRouter') return [{ args: { newDragonRouter: forwarderB } }]
        queries.push({ address: params.address, args: params.args })
        // The RPC filters by strategy; a junk event slipping through must still be dropped.
        return [sent(forwarderA, vaultA, 100n, 90n), sent(forwarderB, vaultA, 50n, 45n), sent(forwarderA, vaultB, 1n, 1n)]
      },
    } as unknown as PublicClient

    const history = await payoutHistory(stub, vaultA, forwarderA, 0n)
    expect(queries).toEqual([{ address: [forwarderA, forwarderB], args: { strategy: vaultA } }])
    expect(history.map((p) => [p.forwarder, p.amount, p.assets])).toEqual([
      [forwarderA, 100n, 90n],
      [forwarderB, 50n, 45n],
    ])
  })
})
