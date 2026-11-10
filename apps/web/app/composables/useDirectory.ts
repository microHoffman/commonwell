import {
  chainLabel,
  findMerged,
  getKind,
  isCurator,
  loadDirectory,
  mergeCommunities,
  payoutHistory,
  previewPayout,
  readPositions,
  readTokenState,
  recordOf,
  validateCommunity,
  type Community,
  type Payout,
  type PayoutPreview,
  type Position,
  type VaultView,
} from '@commonwell/core'
import { useQuery } from '@tanstack/vue-query'
import type { Address } from 'viem'

/// Every community with its validated vaults, merged across chains. Each chain's directory comes
/// from its EAS records; validation recomputes each vault's address and reads its live state. A chain
/// that can't be read is skipped and named in `unavailable`.
export function useDirectory() {
  const deployments = useDeployments()
  const clients = deployments.map((d) => usePublicClient(d.chainId))
  return useQuery({
    queryKey: ['directory', ...deployments.map((d) => d.name)],
    queryFn: async () => {
      const results = await Promise.allSettled(
        deployments.map(async (deployment, i) => {
          const client = clients[i]!
          const directory = await loadDirectory(client, deployment)
          return Promise.all(directory.communities.map((c) => validateCommunity(client, c, deployment)))
        }),
      )
      const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [deployments[i]!] : []))
      if (failed.length === results.length) throw (results[0] as PromiseRejectedResult).reason
      const chains = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
      return { communities: mergeCommunities(chains), unavailable: failed.map((d) => chainLabel(d.chainId)) }
    },
  })
}

/// Communities the directory lists: at least one valid, active vault.
export function listed(communities: Community[] | undefined): Community[] {
  return (communities ?? []).filter((c) => c.vaults.length > 0)
}

export function useCommunity(idOrSlug: MaybeRefOrGetter<string>) {
  const directory = useDirectory()
  const community = computed(() => {
    const data = directory.data.value
    return data ? findMerged(data.communities, toValue(idOrSlug)) : undefined
  })
  return { directory, community }
}

export function communityPath(community: Pick<Community, 'id' | 'slug'>): string {
  return community.slug ? `/${community.slug}` : `/c/${community.id}`
}

/// Identifies a vault across chains, e.g. in `?vault=` links.
export function vaultKey(view: Pick<VaultView, 'chainId' | 'vault'>): string {
  return `${view.chainId}:${view.vault.toLowerCase()}`
}

export type PayoutWithTime = Payout & { timestamp?: bigint }

/// A vault's payouts, newest first; the most recent ones carry their block time.
export function usePayouts(view: MaybeRefOrGetter<VaultView | undefined>) {
  return useQuery({
    queryKey: computed(() => ['payouts', toValue(view) && vaultKey(toValue(view)!)]),
    enabled: computed(() => toValue(view) !== undefined),
    queryFn: async (): Promise<PayoutWithTime[]> => {
      const v = toValue(view)!
      const client = usePublicClient(v.chainId)
      const payouts = (await payoutHistory(client, v.vault, BigInt(useDeployment(v.chainId).deployBlock))).reverse()
      const recent = await Promise.all(payouts.slice(0, 10).map((p) => client.getBlock({ blockNumber: p.blockNumber })))
      return payouts.map((p, i) => ({ ...p, timestamp: recent[i]?.timestamp }))
    },
  })
}

export function totalDonated(payouts: PayoutWithTime[] | undefined): bigint {
  return (payouts ?? []).reduce((sum, p) => sum + p.amount, 0n)
}

export type ChainPosition = Position & { chainId: number }

/// The connected wallet's positions across `views` on any chain (any status: positions stay withdrawable).
export function usePositions(views: MaybeRefOrGetter<Pick<VaultView, 'chainId' | 'vault'>[]>) {
  const { address } = useWallet()
  return useQuery({
    queryKey: computed(() => ['positions', address.value, toValue(views).map(vaultKey)]),
    enabled: computed(() => address.value !== undefined && toValue(views).length > 0),
    queryFn: async (): Promise<ChainPosition[]> => {
      const byChain = new Map<number, Pick<VaultView, 'chainId' | 'vault'>[]>()
      for (const v of toValue(views)) byChain.set(v.chainId, [...(byChain.get(v.chainId) ?? []), v])
      const results = await Promise.all(
        [...byChain].map(async ([chainId, list]) =>
          (await readPositions(usePublicClient(chainId), address.value!, list.map((v) => v.vault))).map((p) => ({ ...p, chainId })),
        ),
      )
      return results.flat()
    },
  })
}

// The trigger is public, so any address can simulate a payout.
const SIMULATION_ACCOUNT: Address = '0x000000000000000000000000000000000000dEaD'

/// The payout that would be sent right now. `value` is valued like deposits and donations (the type's value
/// unit: stETH value, ≈ ETH, for Lido), so all three read in the same unit.
export function usePayoutPreview(view: MaybeRefOrGetter<VaultView | undefined>) {
  const query = useQuery({
    queryKey: computed(() => ['payout-preview', toValue(view) && vaultKey(toValue(view)!)]),
    enabled: computed(() => toValue(view)?.forwarder !== undefined),
    queryFn: (): Promise<PayoutPreview> => {
      const v = toValue(view)!
      return previewPayout(usePublicClient(v.chainId), SIMULATION_ACCOUNT, triggerFor(v), v.forwarder!, v.vault)
    },
    refetchInterval: 60_000,
  })
  const preview = computed(() => query.data.value)
  const value = computed(() => {
    const p = preview.value
    const rate = toValue(view)?.state?.exchangeRate
    return p?.status === 'ready' && rate !== undefined ? (p.assets * rate) / 10n ** 18n : undefined
  })
  return { preview, value, isLoading: query.isLoading }
}

/// Totals across several vaults (a community's vaults on every chain): what was donated and what's
/// ready to pay out, both in the vaults' value unit (stETH value, ≈ ETH, for Lido). `status` explains an empty `ready`.
export function useVaultTotals(views: MaybeRefOrGetter<VaultView[]>) {
  return useQuery({
    queryKey: computed(() => ['vault-totals', toValue(views).map(vaultKey)]),
    enabled: computed(() => toValue(views).length > 0),
    queryFn: async () => {
      const list = toValue(views)
      const [histories, previews] = await Promise.all([
        Promise.all(
          list.map((v) => payoutHistory(usePublicClient(v.chainId), v.vault, BigInt(useDeployment(v.chainId).deployBlock))),
        ),
        Promise.all(
          list.map((v) =>
            v.forwarder ? previewPayout(usePublicClient(v.chainId), SIMULATION_ACCOUNT, triggerFor(v), v.forwarder, v.vault) : undefined,
          ),
        ),
      ])
      let ready = 0n
      previews.forEach((p, i) => {
        if (p?.status === 'ready') ready += (p.assets * (list[i]!.state?.exchangeRate ?? 0n)) / 10n ** 18n
      })
      const statuses = previews.map((p) => p?.status)
      const status = statuses.includes('ready') ? 'ready' : statuses.every((s) => s === 'paused-loss') ? 'paused-loss' : statuses.includes('nothing') ? 'nothing' : 'none'
      return { donated: histories.flat().reduce((sum, p) => sum + p.amount, 0n), ready, status }
    },
    refetchInterval: 60_000,
  })
}

/// The vault's staking APR in percent, from its vault type's source (Lido's API for Lido vaults).
export function useApr(view: MaybeRefOrGetter<VaultView | undefined>) {
  return useQuery({
    queryKey: computed(() => ['apr', toValue(view)?.link.kind, toValue(view)?.chainId]),
    enabled: computed(() => toValue(view) !== undefined),
    queryFn: async () => {
      const v = toValue(view)!
      return (await getKind(v.link.kind)?.fetchApr(v.chainId)) ?? null
    },
    staleTime: 3_600_000,
  })
}

/// The connected wallet's ETH and wstETH on `chainId`, and its wstETH allowance for `spender`.
export function useBalances(chainId: MaybeRefOrGetter<number>, spender: MaybeRefOrGetter<Address | undefined>) {
  const { address } = useWallet()
  return useQuery({
    queryKey: computed(() => ['balances', toValue(chainId), address.value, toValue(spender)]),
    enabled: computed(() => address.value !== undefined),
    queryFn: async () => {
      const owner = address.value!
      const client = usePublicClient(toValue(chainId))
      const asset = Object.values(useDeployment(toValue(chainId)).kinds)[0]!.asset
      const [eth, token] = await Promise.all([
        client.getBalance({ address: owner }),
        readTokenState(client, asset, owner, toValue(spender) ?? owner),
      ])
      return { eth, wsteth: token.balance, allowance: token.allowance }
    },
  })
}

const sameAddress = (a: string | undefined, b: string | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

/// `isOwner`: owns any of the community's records (edits go to those). `isCurator`: a curator on
/// any chain the community has a record on (reviews go to those).
export function useRoles(community: MaybeRefOrGetter<Community | undefined>) {
  const { address } = useWallet()
  return {
    isOwner: computed(() => toValue(community)?.records.some((r) => sameAddress(r.owner, address.value)) ?? false),
    isCurator: computed(
      () => toValue(community)?.records.some((r) => isCurator(useDeployment(r.chainId), address.value)) ?? false,
    ),
  }
}

/// The owner of the record a vault belongs to.
export function ownerOf(community: Community, view: VaultView): Address | undefined {
  return recordOf(community, view)?.owner
}

export function triggerFor(view: VaultView): Address {
  return useDeployment(view.chainId).kinds[view.link.kind]!.payoutTrigger
}
