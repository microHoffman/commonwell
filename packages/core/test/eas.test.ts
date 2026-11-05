import { describe, expect, test } from 'bun:test'
import { encodePacked, keccak256, pad, zeroAddress } from 'viem'
import {
  decodeEndorsement,
  decodeProfile,
  decodeVaultLink,
  encodeEndorsement,
  encodeProfile,
  encodeVaultLink,
  schemaUid,
  SCHEMAS,
} from '../src/index.ts'

describe('EAS schemas', () => {
  test('UIDs follow SchemaRegistry: keccak256(schema, resolver, revocable)', () => {
    const expected = keccak256(
      encodePacked(['string', 'address', 'bool'], [SCHEMAS.communityVault.schema, zeroAddress, true]),
    )
    expect(schemaUid('communityVault')).toBe(expected)
    expect(new Set([schemaUid('community'), schemaUid('communityVault'), schemaUid('endorsement')]).size).toBe(3)
  })

  test('records round-trip', () => {
    const profile = { name: 'Brussels', description: 'A city', website: 'https://brussels.example', imageURI: '' }
    expect(decodeProfile(encodeProfile(profile))).toEqual(profile)

    const link = { chainId: 560048n, kind: 'lido-wsteth-v1', salt: pad('0x2a'), params: '0x1234' as const }
    expect(decodeVaultLink(encodeVaultLink(link))).toEqual(link)

    const endorsement = { slug: 'brussels', note: 'Checked their website' }
    expect(decodeEndorsement(encodeEndorsement(endorsement))).toEqual(endorsement)
  })
})
