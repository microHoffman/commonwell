import { describe, expect, test } from 'bun:test'
import { pad } from 'viem'
import {
  encodeEndorsement,
  encodeProfile,
  encodeVaultLink,
  findCommunity,
  resolveDirectory,
  type Attestation,
} from '../src/index.ts'
import { att, curator, deployment, owner, stranger } from './fixtures.ts'

const { schemas } = deployment
const profile = (name: string) => encodeProfile({ name, description: '', website: '', imageURI: '' })
const link = (salt: number) =>
  encodeVaultLink({ chainId: 560048n, kind: 'lido-wsteth-v1', salt: pad(`0x${salt}`), params: '0x' })

function register(name: string, attester = owner): Attestation {
  return att({ schema: schemas.community, data: profile(name), attester, revocable: false })
}

describe('resolveDirectory', () => {
  test('a registration is a community; only its owner can update the profile', () => {
    const reg = register('Brussels')
    const directory = resolveDirectory(
      [
        reg,
        att({ schema: schemas.community, refUID: reg.uid, data: profile('Fake'), attester: stranger }),
        att({ schema: schemas.community, refUID: reg.uid, data: profile('Brussels v2') }),
        att({ schema: schemas.community, refUID: reg.uid, data: profile('Brussels v3') }),
      ],
      deployment,
    )
    expect(directory.communities).toHaveLength(1)
    expect(directory.communities[0]?.id).toBe(reg.uid)
    expect(directory.communities[0]?.profile.name).toBe('Brussels v3')
  })

  test('vault links count only from the owner; revoked links are retired, not dropped', () => {
    const reg = register('Ghent')
    const vault = '0x00000000000000000000000000000000000000a1'
    const directory = resolveDirectory(
      [
        reg,
        att({ schema: schemas.communityVault, refUID: reg.uid, recipient: vault, data: link(1) }),
        att({ schema: schemas.communityVault, refUID: reg.uid, recipient: vault, data: link(2), attester: stranger }),
        att({ schema: schemas.communityVault, refUID: reg.uid, recipient: vault, data: link(3), revocationTime: 9n }),
      ],
      deployment,
    )
    const vaults = directory.communities[0]!.vaults
    expect(vaults.map((v) => v.salt)).toEqual([pad('0x1'), pad('0x3')])
    expect(vaults.map((v) => v.retired)).toEqual([false, true])
  })

  test('reviews come only from active curator endorsements', () => {
    const a = register('A')
    const b = register('B')
    const c = register('C')
    const directory = resolveDirectory(
      [
        a,
        b,
        c,
        att({ schema: schemas.endorsement, refUID: a.uid, data: encodeEndorsement({ slug: 'aaa', note: '' }), attester: curator }),
        att({ schema: schemas.endorsement, refUID: b.uid, data: encodeEndorsement({ slug: 'bbb', note: '' }), attester: stranger }),
        att({
          schema: schemas.endorsement,
          refUID: c.uid,
          data: encodeEndorsement({ slug: 'ccc', note: '' }),
          attester: curator,
          revocationTime: 5n,
        }),
      ],
      deployment,
    )
    expect(directory.communities.map((x) => x.endorsement?.slug)).toEqual(['aaa', undefined, undefined])
    expect(findCommunity(directory, 'aaa')?.id).toBe(a.uid)
    expect(findCommunity(directory, b.uid)?.id).toBe(b.uid)
  })

  test('a short name belongs to the earliest review; invalid or reserved names give none', () => {
    const a = register('A')
    const b = register('B')
    const c = register('C')
    const endorse = (refUID: `0x${string}`, slug: string) =>
      att({ schema: schemas.endorsement, refUID, data: encodeEndorsement({ slug, note: '' }), attester: curator })
    const directory = resolveDirectory([a, b, c, endorse(a.uid, 'same'), endorse(b.uid, 'same'), endorse(c.uid, 'new')], deployment)
    expect(directory.communities.map((x) => x.endorsement?.slug)).toEqual(['same', undefined, undefined])
    // Still reviewed, just without a short name.
    expect(directory.communities.every((x) => x.endorsement !== undefined)).toBe(true)
    expect(directory.slugs.get('same')).toBe(a.uid)
  })

  test('records with an expiry, unknown references or bad data are ignored', () => {
    const reg = register('A')
    const directory = resolveDirectory(
      [
        att({ schema: schemas.community, data: profile('Expiring'), expirationTime: 99n }),
        att({ schema: schemas.community, data: '0xdeadbeef' }),
        reg,
        att({ schema: schemas.communityVault, refUID: pad('0xbeef'), data: link(1) }),
        att({ schema: schemas.communityVault, refUID: reg.uid, data: '0x01' }),
      ],
      deployment,
    )
    expect(directory.communities).toHaveLength(1)
    expect(directory.communities[0]?.vaults).toHaveLength(0)
  })
})
