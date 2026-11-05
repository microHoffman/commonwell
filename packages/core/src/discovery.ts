import { getAbiItem, zeroHash, type Address, type Hex, type PublicClient } from 'viem'
import { MULTICALL3, type Deployment } from './config.ts'
import { decodeEndorsement, decodeProfile, decodeVaultLink, type Attestation, type Profile } from './eas.ts'
import { isValidSlug } from './format.ts'
import { easAbi } from './generated/common.ts'
import { getLogsChunked } from './logs.ts'

export type VaultLinkRecord = {
  uid: Hex
  vault: Address
  chainId: bigint
  kind: string
  salt: Hex
  params: Hex
  time: bigint
  retired: boolean
  /// The transaction that created the record, when known.
  tx?: Hex
}

export type EndorsementRecord = { uid: Hex; curator: Address; slug?: string; note: string; time: bigint; tx?: Hex }

export type CommunityRecord = {
  id: Hex
  owner: Address
  registeredAt: bigint
  profile: Profile
  /// When the current profile was published, to pick the newest one across chains.
  profileTime: bigint
  tx?: Hex
  vaults: VaultLinkRecord[]
  endorsement?: EndorsementRecord
}

export type Directory = {
  communities: CommunityRecord[]
  /// Short name → community ID, for reviewed communities only.
  slugs: Map<string, Hex>
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

function tryDecode<T>(decode: () => T): T | undefined {
  try {
    return decode()
  } catch {
    return undefined
  }
}

/// Applies the app's rules to attestations in chain order (block, log index):
/// - a Community record with no refUID registers a community; its UID is the ID and its attester the owner;
/// - later Community records referencing it are profile updates, accepted only from the owner (latest wins);
/// - CommunityVault records referencing it link vaults, accepted only from the owner; revoked = retired;
/// - Endorsements referencing it come from curators; the earliest active one counts, and a short name
///   belongs to the community whose endorsement claimed it first.
/// The app's schemas never expire, so any record with an expiry is ignored.
export function resolveDirectory(
  attestations: Attestation[],
  deployment: Pick<Deployment, 'schemas' | 'curators'>,
  txHashes: Map<Hex, Hex> = new Map(),
): Directory {
  const { schemas } = deployment
  const byId = new Map<Hex, CommunityRecord>()
  const order: CommunityRecord[] = []
  const slugs = new Map<string, Hex>()
  const live = attestations.filter((a) => a.expirationTime === 0n)

  for (const a of live) {
    if (a.schema !== schemas.community || a.refUID !== zeroHash) continue
    const profile = tryDecode(() => decodeProfile(a.data))
    if (!profile) continue
    const record: CommunityRecord = {
      id: a.uid,
      owner: a.attester,
      registeredAt: a.time,
      profile,
      profileTime: a.time,
      tx: txHashes.get(a.uid),
      vaults: [],
    }
    byId.set(a.uid, record)
    order.push(record)
  }

  for (const a of live) {
    const community = byId.get(a.refUID)
    if (!community) continue

    if (a.schema === schemas.community && same(a.attester, community.owner)) {
      const profile = tryDecode(() => decodeProfile(a.data))
      if (profile) {
        community.profile = profile
        community.profileTime = a.time
      }
    } else if (a.schema === schemas.communityVault && same(a.attester, community.owner)) {
      const link = tryDecode(() => decodeVaultLink(a.data))
      if (link) {
        community.vaults.push({
          uid: a.uid,
          vault: a.recipient,
          ...link,
          time: a.time,
          retired: a.revocationTime !== 0n,
          tx: txHashes.get(a.uid),
        })
      }
    } else if (
      a.schema === schemas.endorsement &&
      a.revocationTime === 0n &&
      !community.endorsement &&
      deployment.curators.some((curator) => same(curator, a.attester))
    ) {
      const endorsement = tryDecode(() => decodeEndorsement(a.data))
      if (!endorsement) continue
      const free = isValidSlug(endorsement.slug) && !slugs.has(endorsement.slug)
      if (free) slugs.set(endorsement.slug, community.id)
      community.endorsement = {
        uid: a.uid,
        curator: a.attester,
        slug: free ? endorsement.slug : undefined,
        note: endorsement.note,
        time: a.time,
        tx: txHashes.get(a.uid),
      }
    }
  }

  return { communities: order, slugs }
}

const attestedEvent = getAbiItem({ abi: easAbi, name: 'Attested' })

export async function fetchAttestations(client: PublicClient, eas: Address, uids: Hex[]): Promise<Attestation[]> {
  if (uids.length === 0) return []
  return (await client.multicall({
    contracts: uids.map((uid) => ({ address: eas, abi: easAbi, functionName: 'getAttestation', args: [uid] }) as const),
    allowFailure: false,
    multicallAddress: MULTICALL3,
  })) as Attestation[]
}

/// Reads every app attestation from the deployment's EAS contract. Kept behind this one function so a
/// hosted index (e.g. EAS GraphQL on mainnet) can replace the log scan later.
export async function loadDirectory(client: PublicClient, deployment: Deployment): Promise<Directory> {
  const { schemas } = deployment
  const logs = await getLogsChunked(client, {
    address: deployment.eas,
    event: attestedEvent,
    args: { schemaUID: [schemas.community, schemas.communityVault, schemas.endorsement] },
    fromBlock: BigInt(deployment.deployBlock),
  })
  const txHashes = new Map<Hex, Hex>()
  for (const log of logs) if (log.args.uid) txHashes.set(log.args.uid, log.transactionHash)
  const uids = [...txHashes.keys()]
  return resolveDirectory(await fetchAttestations(client, deployment.eas, uids), deployment, txHashes)
}

export function findCommunity(directory: Directory, idOrSlug: string): CommunityRecord | undefined {
  const id = directory.slugs.get(idOrSlug) ?? idOrSlug
  return directory.communities.find((c) => same(c.id, id))
}
