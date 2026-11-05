import type { Address, PublicClient } from 'viem'
import { MULTICALL3, type Deployment } from './config.ts'
import { hasCode } from './create2.ts'
import type { CommunityRecord, VaultLinkRecord } from './discovery.ts'
import { getKind, lidoWstethV1 } from './kinds/index.ts'
import { vaultAbi } from './generated/kinds/lido-wsteth-v1.ts'

const COOLDOWN = 14n * 24n * 3600n

/// Live state of a vault, read in one multicall.
export type VaultState = {
  management: Address
  keeper: Address
  emergencyAdmin: Address
  dragonRouter: Address
  pendingDragonRouter: Address
  dragonRouterChangeTimestamp: bigint
  isShutdown: boolean
  totalSupply: bigint
  totalAssets: bigint
  exchangeRate: bigint
  depositorValue: bigint
  forwarderShares: bigint
  maxDeposit: bigint
}

export type VaultView = {
  link: VaultLinkRecord
  /// The chain the vault was read on (its deployment's chain).
  chainId: number
  vault: Address
  forwarder?: Address
  treasury?: Address
  params?: lidoWstethV1.Params
  /// Reasons the vault fails validation; empty means valid.
  problems: string[]
  state?: VaultState
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/// Offline part of validation: rebuilds the vault's CREATE2 address from the link settings with the
/// type's frozen code. A match proves the exact code, immutables and initial storage, whoever deployed it.
export function checkLink(
  link: VaultLinkRecord,
  owner: Address,
  deployment: Deployment,
): Omit<VaultView, 'state'> {
  const view: Omit<VaultView, 'state'> = { link, chainId: deployment.chainId, vault: link.vault, problems: [] }
  const kindConfig = deployment.kinds[link.kind]
  const kind = getKind(link.kind)
  if (!kind || !kindConfig) return { ...view, problems: [`Unknown vault type ${link.kind}`] }
  if (link.chainId !== BigInt(deployment.chainId)) return { ...view, problems: [`Vault is on chain ${link.chainId}`] }

  let params: lidoWstethV1.Params
  try {
    params = kind.decodeParams(link.params)
  } catch {
    return { ...view, problems: ['Unreadable vault settings'] }
  }
  const { forwarder, vault } = kind.buildContracts(params, owner, kindConfig, deployment.create2Deployer, link.salt)
  const problems: string[] = []
  if (!same(vault.address, link.vault)) problems.push('Vault address does not match its settings')

  // Multicall3 passes on anyone's call, so a role it holds belongs to everyone; the trigger can't act at all.
  const publicContracts = [MULTICALL3, deployment.multicall3, kindConfig.payoutTrigger]
  const roles: [string, Address][] = [
    ['owner', owner],
    ['emergency admin', params.emergencyAdmin],
    ['treasury', params.treasury],
  ]
  for (const [role, account] of roles) {
    if (publicContracts.some((c) => same(c, account))) problems.push(`The ${role} is a public contract`)
  }
  return { ...view, forwarder: forwarder.address, treasury: params.treasury, params, problems }
}

// maxDeposit's limit is the same for every receiver except the forwarder and the vault itself.
const SAMPLE_RECEIVER: Address = '0x000000000000000000000000000000000000dEaD'
const STATE_READS = [
  'management',
  'keeper',
  'emergencyAdmin',
  'dragonRouter',
  'pendingDragonRouter',
  'dragonRouterChangeTimestamp',
  'isShutdown',
  'totalSupply',
  'totalAssets',
  'getCurrentExchangeRate',
  'gettotalDebtOwedToUserInAssetValue',
] as const

export async function readVaultState(client: PublicClient, vault: Address, forwarder: Address): Promise<VaultState | undefined> {
  const results = await client.multicall({
    contracts: [
      ...STATE_READS.map((functionName) => ({ address: vault, abi: vaultAbi, functionName }) as const),
      { address: vault, abi: vaultAbi, functionName: 'balanceOf', args: [forwarder] } as const,
      { address: vault, abi: vaultAbi, functionName: 'maxDeposit', args: [SAMPLE_RECEIVER] } as const,
    ],
    allowFailure: true,
    multicallAddress: MULTICALL3,
  })
  if (results.some((r) => r.status !== 'success')) return undefined
  const [
    management,
    keeper,
    emergencyAdmin,
    dragonRouter,
    pendingDragonRouter,
    dragonRouterChangeTimestamp,
    isShutdown,
    totalSupply,
    totalAssets,
    exchangeRate,
    depositorValue,
    forwarderShares,
    maxDeposit,
  ] = results.map((r) => r.result) as [
    Address,
    Address,
    Address,
    Address,
    Address,
    bigint,
    boolean,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ]
  return {
    management,
    keeper,
    emergencyAdmin,
    dragonRouter,
    pendingDragonRouter,
    dragonRouterChangeTimestamp,
    isShutdown,
    totalSupply,
    totalAssets,
    exchangeRate,
    depositorValue,
    forwarderShares,
    maxDeposit,
  }
}

/// Online part of validation: roles must still be wired the way the vault was created.
export function checkState(state: VaultState, owner: Address, forwarder: Address, deployment: Deployment, kind: string): string[] {
  const problems: string[] = []
  if (!same(state.management, owner)) problems.push('Management changed hands')
  if (!same(state.keeper, forwarder)) problems.push('The payout forwarder is no longer the keeper')
  if (!same(state.dragonRouter, forwarder)) problems.push('Payouts no longer go to the linked forwarder')
  const publicContracts = [MULTICALL3, deployment.multicall3, deployment.kinds[kind]?.payoutTrigger ?? MULTICALL3]
  if (publicContracts.some((c) => same(c, state.emergencyAdmin))) problems.push('The emergency admin is a public contract')
  return problems
}

export type VaultFlags = {
  depositsOpen: boolean
  /// Octant blocks deposits while a vault holds assets but no shares (e.g. after everyone withdrew);
  /// a double payout reopens it.
  needsReopen: boolean
  shutdown: boolean
  pendingChange?: { to: Address; eligibleAt: bigint }
}

export function vaultFlags(state: VaultState): VaultFlags {
  const needsReopen = !state.isShutdown && state.totalSupply === 0n && state.totalAssets > 0n
  const pending = state.pendingDragonRouter !== '0x0000000000000000000000000000000000000000'
  return {
    depositsOpen: state.maxDeposit > 0n,
    needsReopen,
    shutdown: state.isShutdown,
    pendingChange: pending
      ? { to: state.pendingDragonRouter, eligibleAt: state.dragonRouterChangeTimestamp + COOLDOWN }
      : undefined,
  }
}

export async function validateVault(
  client: PublicClient,
  link: VaultLinkRecord,
  owner: Address,
  deployment: Deployment,
): Promise<VaultView> {
  const view: VaultView = checkLink(link, owner, deployment)
  if (view.problems.length > 0 || !view.forwarder) return view
  const [vaultDeployed, forwarderDeployed] = await Promise.all([hasCode(client, link.vault), hasCode(client, view.forwarder)])
  if (!vaultDeployed || !forwarderDeployed) return { ...view, problems: ['Contracts are not deployed'] }
  const state = await readVaultState(client, link.vault, view.forwarder)
  if (!state) return { ...view, problems: ['Not readable as a vault'] }
  return { ...view, state, problems: checkState(state, owner, view.forwarder, deployment, link.kind) }
}

/// One chain's record of a community, validated. `mergeCommunities` groups these across chains.
export type CommunityView = CommunityRecord & {
  chainId: number
  /// Every linked vault, valid or not, retired or not (positions must stay withdrawable).
  vaultViews: VaultView[]
  /// Every valid vault whose link isn't retired, newest first: the ones the community page offers.
  /// An owner stops offering one by revoking its link.
  active: VaultView[]
  reviewed: boolean
}

/// The vaults a community page offers, from links in the order they were made: valid, not retired, newest first.
export function activeVaults(vaultViews: VaultView[]): VaultView[] {
  return [...vaultViews].reverse().filter((v) => !v.link.retired && v.problems.length === 0)
}

export async function validateCommunity(client: PublicClient, community: CommunityRecord, deployment: Deployment): Promise<CommunityView> {
  const vaultViews = await Promise.all(community.vaults.map((link) => validateVault(client, link, community.owner, deployment)))
  return { ...community, chainId: deployment.chainId, vaultViews, active: activeVaults(vaultViews), reviewed: community.endorsement !== undefined }
}

