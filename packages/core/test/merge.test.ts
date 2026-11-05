import { describe, expect, test } from 'bun:test'
import { pad, slice, type Address, type Hex } from 'viem'
import { findMerged, mergeCommunities, recordOf, type CommunityView, type VaultView } from '../src/index.ts'
import { curator, owner, stranger, uid } from './fixtures.ts'

const MAINNET = 1
const HOODI = 560048

function record(
  chainId: number,
  name: string,
  opts: { owner?: Address; slug?: string; profileTime?: bigint; vault?: boolean } = {},
): CommunityView {
  const id: Hex = uid()
  const vaultViews: VaultView[] =
    opts.vault === false
      ? []
      : [
          {
            chainId,
            vault: slice(id, 12),
            link: {
              uid: uid(),
              vault: slice(id, 12),
              chainId: BigInt(chainId),
              kind: 'lido-wsteth-v1',
              salt: pad('0x1'),
              params: '0x',
              time: 1n,
              retired: false,
            },
            problems: [],
          },
        ]
  return {
    id,
    chainId,
    owner: opts.owner ?? owner,
    registeredAt: 1n,
    profile: { name, description: '', website: '', imageURI: '' },
    profileTime: opts.profileTime ?? 1n,
    vaults: [],
    endorsement: opts.slug ? { uid: uid(), curator, slug: opts.slug, note: '', time: 1n } : undefined,
    vaultViews,
    active: vaultViews,
    reviewed: opts.slug !== undefined,
  }
}

describe('mergeCommunities', () => {
  test('same owner and name on two chains is one community with both vaults', () => {
    const a = record(HOODI, 'Brussels')
    const b = record(MAINNET, ' brussels ', { profileTime: 5n })
    const merged = mergeCommunities([[a], [b]])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.id).toBe(a.id)
    expect(merged[0]!.profile.name).toBe(' brussels ')
    expect(merged[0]!.vaults.map((v) => v.chainId)).toEqual([HOODI, MAINNET])
    expect(recordOf(merged[0]!, merged[0]!.vaults[1]!)).toBe(b)
  })

  test('the same name from another owner stays separate', () => {
    const merged = mergeCommunities([[record(HOODI, 'Brussels')], [record(MAINNET, 'Brussels', { owner: stranger })]])
    expect(merged).toHaveLength(2)
  })

  test('a shared review short name merges records, whoever owns them', () => {
    const a = record(HOODI, 'Brussels', { slug: 'brussels' })
    const b = record(MAINNET, 'Brussels Commons', { owner: stranger, slug: 'brussels' })
    const merged = mergeCommunities([[a], [b]])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.slug).toBe('brussels')
    expect(merged[0]!.reviewed).toBe(true)
  })

  test('records on the same chain are never merged with each other directly', () => {
    const merged = mergeCommunities([[record(HOODI, 'Ghent'), record(HOODI, 'Ghent')]])
    expect(merged).toHaveLength(2)
  })

  test('reviewed on one chain is reviewed; a record without a vault adds none', () => {
    const merged = mergeCommunities([[record(HOODI, 'Liège', { slug: 'liege' })], [record(MAINNET, 'Liège', { vault: false })]])
    expect(merged[0]!.reviewed).toBe(true)
    expect(merged[0]!.vaults).toHaveLength(1)
  })

  test('every active vault of a record is offered, in the record order', () => {
    const a = record(HOODI, 'Mons')
    const second = { ...a.active[0]!, vault: slice(uid(), 12) }
    const merged = mergeCommunities([[{ ...a, active: [second, ...a.active] }], [record(MAINNET, 'Mons')]])
    expect(merged[0]!.vaults.map((v) => v.chainId)).toEqual([HOODI, HOODI, MAINNET])
    expect(merged[0]!.vaults[0]).toBe(second)
  })

  test('findMerged finds a community by any record ID or short name', () => {
    const a = record(HOODI, 'Antwerp', { slug: 'antwerp' })
    const b = record(MAINNET, 'Antwerp')
    const merged = mergeCommunities([[a], [b]])
    expect(findMerged(merged, b.id)?.id).toBe(a.id)
    expect(findMerged(merged, 'antwerp')?.id).toBe(a.id)
    expect(findMerged(merged, 'nope')).toBeUndefined()
  })
})
