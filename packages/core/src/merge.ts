import type { Hex } from 'viem'
import type { Profile } from './eas.ts'
import type { CommunityView, VaultView } from './validation.ts'

/// One community as the app shows it: its records on every chain the app reads, merged.
export type Community = {
  /// The first record's ID. Any of its records' IDs finds it too.
  id: Hex
  /// Short name from the first reviewed record that has one.
  slug?: string
  /// The most recently published profile across its records.
  profile: Profile
  reviewed: boolean
  /// In deployment order, then registration order.
  records: CommunityView[]
  /// Every linked vault, valid or not, retired or not (positions must stay withdrawable).
  vaultViews: VaultView[]
  /// Each record's active vaults, newest first: the ones the community page offers. The first is the default.
  vaults: VaultView[]
}

const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const nameKey = (name: string) => name.trim().toLowerCase()

/// Records on different chains are one community when a curator gave them the same short name, or
/// when the same owner registered them under the same name. Only an owner can attest as themselves,
/// so nobody can merge their record into someone else's community.
export function mergeCommunities(chains: CommunityView[][]): Community[] {
  const records = chains.flat()
  const parent = records.map((_, i) => i)
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)))
  const union = (a: number, b: number) => {
    const [ra, rb] = [root(a), root(b)]
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
  }

  const groups = new Map<string, number[]>()
  records.forEach((record, i) => {
    const keys = [`owner:${record.owner.toLowerCase()}:${nameKey(record.profile.name)}`]
    if (record.endorsement?.slug) keys.push(`slug:${record.endorsement.slug}`)
    for (const key of keys) groups.set(key, [...(groups.get(key) ?? []), i])
  })
  for (const members of groups.values()) {
    for (const a of members) {
      for (const b of members) if (records[a]!.chainId !== records[b]!.chainId) union(a, b)
    }
  }

  const byRoot = new Map<number, CommunityView[]>()
  records.forEach((record, i) => byRoot.set(root(i), [...(byRoot.get(root(i)) ?? []), record]))
  return [...byRoot.values()].map((members) => {
    const newest = members.reduce((a, b) => (b.profileTime > a.profileTime ? b : a))
    return {
      id: members[0]!.id,
      slug: members.find((r) => r.endorsement?.slug)?.endorsement?.slug,
      profile: newest.profile,
      reviewed: members.some((r) => r.reviewed),
      records: members,
      vaultViews: members.flatMap((r) => r.vaultViews),
      vaults: members.flatMap((r) => r.active),
    }
  })
}

/// Finds a community by any of its short names or record IDs.
export function findMerged(communities: Community[], idOrSlug: string): Community | undefined {
  return communities.find((c) =>
    c.records.some((r) => r.endorsement?.slug === idOrSlug || sameAddress(r.id, idOrSlug)),
  )
}

/// The record a vault belongs to: its owner, registration and review.
export function recordOf(community: Community, view: VaultView): CommunityView | undefined {
  return community.records.find((r) => r.vaultViews.includes(view))
}
