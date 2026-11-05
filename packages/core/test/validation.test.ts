import { describe, expect, test } from 'bun:test'
import { pad, zeroAddress, type Address } from 'viem'
import {
  activeVaults,
  checkLink,
  checkState,
  communityVaultParams,
  lidoWstethV1,
  MULTICALL3,
  planVault,
  vaultFlags,
  type VaultLinkRecord,
  type VaultState,
  type VaultView,
} from '../src/index.ts'
import { deployment, owner, stranger, treasury } from './fixtures.ts'

const trigger = deployment.kinds['lido-wsteth-v1']!.payoutTrigger

function linkFor(planOwner: Address, params: lidoWstethV1.Params, overrides: Partial<VaultLinkRecord> = {}): VaultLinkRecord {
  const plan = planVault(deployment, planOwner, params, pad('0x42'))
  return {
    uid: pad('0x1'),
    vault: plan.vault.address,
    chainId: 560048n,
    kind: 'lido-wsteth-v1',
    salt: plan.salt,
    params: lidoWstethV1.encodeParams(params),
    time: 1n,
    retired: false,
    ...overrides,
  }
}

const params = communityVaultParams('Brussels', treasury, owner)

describe('checkLink', () => {
  test('accepts a vault whose address matches its settings', () => {
    const result = checkLink(linkFor(owner, params), owner, deployment)
    expect(result.problems).toEqual([])
    expect(result.treasury).toBe(treasury)
    expect(result.forwarder).toBe(planVault(deployment, owner, params, pad('0x42')).forwarder.address)
  })

  test('rejects any setting that differs from the deployed vault', () => {
    const good = linkFor(owner, params)
    const otherTreasury = lidoWstethV1.encodeParams({ ...params, treasury: stranger })
    const cases: VaultLinkRecord[] = [
      { ...good, salt: pad('0x43') },
      { ...good, params: otherTreasury },
      { ...good, vault: stranger },
    ]
    for (const link of cases) {
      expect(checkLink(link, owner, deployment).problems).toContain('Vault address does not match its settings')
    }
    // Claiming someone else's vault: the owner is part of the address.
    expect(checkLink(good, stranger, deployment).problems).toContain('Vault address does not match its settings')
  })

  test('rejects unknown types, other chains and unreadable settings', () => {
    const good = linkFor(owner, params)
    expect(checkLink({ ...good, kind: 'lido-wsteth-v9' }, owner, deployment).problems[0]).toMatch(/Unknown vault type/)
    expect(checkLink({ ...good, chainId: 1n }, owner, deployment).problems[0]).toMatch(/chain 1/)
    expect(checkLink({ ...good, params: '0x01' }, owner, deployment).problems).toEqual(['Unreadable vault settings'])
  })

  test('rejects public contracts in any role', () => {
    expect(checkLink(linkFor(MULTICALL3, { ...params, emergencyAdmin: owner }), MULTICALL3, deployment).problems).toContain(
      'The owner is a public contract',
    )
    expect(checkLink(linkFor(owner, { ...params, treasury: trigger }), owner, deployment).problems).toContain(
      'The treasury is a public contract',
    )
    expect(checkLink(linkFor(owner, { ...params, emergencyAdmin: MULTICALL3 }), owner, deployment).problems).toContain(
      'The emergency admin is a public contract',
    )
  })
})

const forwarder: Address = '0x00000000000000000000000000000000000000f1'
const state: VaultState = {
  management: owner,
  keeper: forwarder,
  emergencyAdmin: owner,
  dragonRouter: forwarder,
  pendingDragonRouter: zeroAddress,
  dragonRouterChangeTimestamp: 0n,
  isShutdown: false,
  totalSupply: 10n,
  totalAssets: 10n,
  exchangeRate: 10n ** 18n,
  depositorValue: 10n,
  forwarderShares: 0n,
  maxDeposit: 2n ** 256n - 1n,
}

describe('checkState', () => {
  test('accepts the wiring the vault was created with', () => {
    expect(checkState(state, owner, forwarder, deployment, 'lido-wsteth-v1')).toEqual([])
  })

  test('flags changed roles', () => {
    const problems = checkState(
      { ...state, management: stranger, keeper: stranger, dragonRouter: stranger, emergencyAdmin: MULTICALL3 },
      owner,
      forwarder,
      deployment,
      'lido-wsteth-v1',
    )
    expect(problems).toHaveLength(4)
  })
})

describe('activeVaults', () => {
  test('offers every valid, unretired vault, newest first', () => {
    const view = (n: number, overrides: { retired?: boolean; problems?: string[] } = {}): VaultView => ({
      ...checkLink(linkFor(owner, params, { uid: pad(`0x${n}`), retired: overrides.retired ?? false }), owner, deployment),
      problems: overrides.problems ?? [],
    })
    const [old, retired, broken, newest] = [view(1), view(2, { retired: true }), view(3, { problems: ['x'] }), view(4)]
    expect(activeVaults([old, retired, broken, newest])).toEqual([newest, old])
  })
})

describe('vaultFlags', () => {
  test('assets without shares need a reopen', () => {
    expect(vaultFlags({ ...state, totalSupply: 0n, totalAssets: 1n, maxDeposit: 0n })).toMatchObject({
      depositsOpen: false,
      needsReopen: true,
    })
    expect(vaultFlags({ ...state, totalSupply: 0n, totalAssets: 0n }).needsReopen).toBe(false)
  })

  test('a pending payout-address change is eligible 14 days after it was queued', () => {
    const flags = vaultFlags({ ...state, pendingDragonRouter: stranger, dragonRouterChangeTimestamp: 1000n })
    expect(flags.pendingChange).toEqual({ to: stranger, eligibleAt: 1000n + 14n * 86400n })
  })
})
