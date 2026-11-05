import {
  decodeAbiParameters,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  parseAbiParameters,
  parseEventLogs,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import type { Wallet } from './create2.ts'
import { easAbi } from './generated/common.ts'

/// The app's three schemas. No resolver and no expiry; profile and link records reference the
/// community registration through refUID.
export const SCHEMAS = {
  community: {
    schema: 'string name,string description,string website,string imageURI',
    revocable: false,
  },
  communityVault: {
    schema: 'uint256 chainId,string kind,bytes32 salt,bytes params',
    revocable: true,
  },
  endorsement: {
    schema: 'string slug,string note',
    revocable: true,
  },
} as const

export type SchemaName = keyof typeof SCHEMAS

/// Same UID SchemaRegistry computes: keccak256(schema ‖ resolver ‖ revocable).
export function schemaUid(name: SchemaName): Hex {
  const { schema, revocable } = SCHEMAS[name]
  return keccak256(encodePacked(['string', 'address', 'bool'], [schema, zeroAddress, revocable]))
}

export type Profile = { name: string; description: string; website: string; imageURI: string }
export type VaultLinkData = { chainId: bigint; kind: string; salt: Hex; params: Hex }
export type EndorsementData = { slug: string; note: string }

const communityParams = parseAbiParameters(SCHEMAS.community.schema)
const vaultParams = parseAbiParameters(SCHEMAS.communityVault.schema)
const endorsementParams = parseAbiParameters(SCHEMAS.endorsement.schema)

export function encodeProfile(p: Profile): Hex {
  return encodeAbiParameters(communityParams, [p.name, p.description, p.website, p.imageURI])
}

export function decodeProfile(data: Hex): Profile {
  const [name, description, website, imageURI] = decodeAbiParameters(communityParams, data)
  return { name, description, website, imageURI }
}

export function encodeVaultLink(v: VaultLinkData): Hex {
  return encodeAbiParameters(vaultParams, [v.chainId, v.kind, v.salt, v.params])
}

export function decodeVaultLink(data: Hex): VaultLinkData {
  const [chainId, kind, salt, params] = decodeAbiParameters(vaultParams, data)
  return { chainId, kind, salt, params }
}

export function encodeEndorsement(e: EndorsementData): Hex {
  return encodeAbiParameters(endorsementParams, [e.slug, e.note])
}

export function decodeEndorsement(data: Hex): EndorsementData {
  const [slug, note] = decodeAbiParameters(endorsementParams, data)
  return { slug, note }
}

export type Attestation = {
  uid: Hex
  schema: Hex
  time: bigint
  expirationTime: bigint
  revocationTime: bigint
  refUID: Hex
  recipient: Address
  attester: Address
  revocable: boolean
  data: Hex
}

export async function attest(
  client: PublicClient,
  wallet: Wallet,
  eas: Address,
  schema: Hex,
  request: { recipient?: Address; refUID?: Hex; revocable: boolean; data: Hex },
): Promise<{ uid: Hex; hash: Hex }> {
  const hash = await wallet.writeContract({
    address: eas,
    abi: easAbi,
    functionName: 'attest',
    args: [
      {
        schema,
        data: {
          recipient: request.recipient ?? zeroAddress,
          expirationTime: 0n,
          revocable: request.revocable,
          refUID: request.refUID ?? zeroHash,
          data: request.data,
          value: 0n,
        },
      },
    ],
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  const [event] = parseEventLogs({ abi: easAbi, eventName: 'Attested', logs: receipt.logs })
  if (receipt.status !== 'success' || !event) throw new Error(`Attestation failed (${hash})`)
  return { uid: event.args.uid, hash }
}

export async function revoke(client: PublicClient, wallet: Wallet, eas: Address, schema: Hex, uid: Hex): Promise<Hex> {
  const hash = await wallet.writeContract({
    address: eas,
    abi: easAbi,
    functionName: 'revoke',
    args: [{ schema, data: { uid, value: 0n } }],
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Revocation failed (${hash})`)
  return hash
}
