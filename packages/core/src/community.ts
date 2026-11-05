import { bytesToHex, encodePacked, keccak256, type Address, type Hex, type PublicClient } from 'viem'
import type { Deployment } from './config.ts'
import { deployCreate2, type Wallet } from './create2.ts'
import { attest, encodeEndorsement, encodeProfile, encodeVaultLink, revoke, SCHEMAS, type Profile } from './eas.ts'
import { DEFAULT_KIND, getKind, type VaultKindId } from './kinds/index.ts'
import type { Params } from './kinds/lido-wsteth-v1.ts'

export function newSalt(owner: Address): Hex {
  return keccak256(encodePacked(['address', 'bytes32'], [owner, bytesToHex(crypto.getRandomValues(new Uint8Array(32)))]))
}

/// Default vault settings for a new community: the owner is also the emergency admin.
export function communityVaultParams(name: string, treasury: Address, owner: Address): Params {
  return { treasury, emergencyAdmin: owner, vaultName: `${name} · Commonwell wstETH`.slice(0, 64), vaultSymbol: 'cwWSTETH' }
}

/// What creating a vault deploys. Both addresses are known before anything is sent.
export function planVault(deployment: Deployment, owner: Address, params: Params, salt: Hex, kindId: VaultKindId = DEFAULT_KIND) {
  const kind = getKind(kindId)
  const kindConfig = deployment.kinds[kindId]
  if (!kind || !kindConfig) throw new Error(`Vault type ${kindId} isn't deployed on ${deployment.name}`)
  return { kindId, salt, params, ...kind.buildContracts(params, owner, kindConfig, deployment.create2Deployer, salt) }
}

export type VaultPlan = ReturnType<typeof planVault>

export type Step = 'forwarder' | 'vault' | 'register' | 'link'

/// Saved after every step so a reload resumes where it stopped. Deploy steps are idempotent anyway:
/// CREATE2 skips contracts that already exist.
export type Progress = { salt: Hex; communityId?: Hex; linkUid?: Hex; hashes: Partial<Record<Step, Hex>> }

export type Events = { onStep?: (step: Step) => void; onProgress?: (progress: Progress) => void }

type Context = { client: PublicClient; wallet: Wallet; deployment: Deployment; events: Events }

function record(ctx: Context, progress: Progress, patch: Omit<Partial<Progress>, 'hashes'>, step: Step, hash: Hex): Progress {
  const next = { ...progress, ...patch, hashes: { ...progress.hashes, [step]: hash } }
  ctx.events.onProgress?.(next)
  return next
}

async function deployContracts(ctx: Context, plan: VaultPlan, progress: Progress): Promise<Progress> {
  for (const step of ['forwarder', 'vault'] as const) {
    ctx.events.onStep?.(step)
    const { hash } = await deployCreate2(ctx.client, ctx.wallet, ctx.deployment.create2Deployer, plan.salt, plan[step].initCode)
    if (hash) progress = record(ctx, progress, {}, step, hash)
  }
  return progress
}

async function linkVault(ctx: Context, plan: VaultPlan, progress: Progress): Promise<Progress> {
  if (progress.linkUid) return progress
  if (!progress.communityId) throw new Error('Register the community first')
  ctx.events.onStep?.('link')
  const kind = getKind(plan.kindId)!
  const { uid, hash } = await attest(ctx.client, ctx.wallet, ctx.deployment.eas, ctx.deployment.schemas.communityVault, {
    recipient: plan.vault.address,
    refUID: progress.communityId,
    revocable: SCHEMAS.communityVault.revocable,
    data: encodeVaultLink({
      chainId: BigInt(ctx.deployment.chainId),
      kind: plan.kindId,
      salt: plan.salt,
      params: kind.encodeParams(plan.params),
    }),
  })
  return record(ctx, progress, { linkUid: uid }, 'link', hash)
}

/// The in-app wizard and the seed script: deploy the forwarder, then the vault, then register the
/// community and link the vault. The connected wallet is the owner: vault management and the
/// attester of both records. Deploying first means a failed deployment never leaves an empty
/// registration behind.
export async function createCommunity(
  client: PublicClient,
  wallet: Wallet,
  deployment: Deployment,
  input: { profile: Profile; treasury: Address },
  progress: Progress,
  events: Events = {},
): Promise<Progress> {
  const ctx = { client, wallet, deployment, events }
  const owner = wallet.account.address
  const plan = planVault(deployment, owner, communityVaultParams(input.profile.name, input.treasury, owner), progress.salt)
  progress = await deployContracts(ctx, plan, progress)
  if (!progress.communityId) {
    events.onStep?.('register')
    const { uid, hash } = await attest(client, wallet, deployment.eas, deployment.schemas.community, {
      revocable: SCHEMAS.community.revocable,
      data: encodeProfile(input.profile),
    })
    progress = record(ctx, progress, { communityId: uid }, 'register', hash)
  }
  return linkVault(ctx, plan, progress)
}

/// Deploys another vault for an existing community and links it (for "Add vault", later).
export async function deployAndLinkVault(
  client: PublicClient,
  wallet: Wallet,
  deployment: Deployment,
  plan: VaultPlan,
  progress: Progress,
  events: Events = {},
): Promise<Progress> {
  const ctx = { client, wallet, deployment, events }
  return linkVault(ctx, plan, await deployContracts(ctx, plan, progress))
}

/// Profile edits are new Community records referencing the registration; only the owner's count.
export function updateProfile(client: PublicClient, wallet: Wallet, deployment: Deployment, communityId: Hex, profile: Profile) {
  return attest(client, wallet, deployment.eas, deployment.schemas.community, {
    refUID: communityId,
    revocable: SCHEMAS.community.revocable,
    data: encodeProfile(profile),
  })
}

/// A curator's review: one EAS record carrying the short name. Changes nothing on the vault.
export function endorse(client: PublicClient, wallet: Wallet, deployment: Deployment, communityId: Hex, slug: string, note = '') {
  return attest(client, wallet, deployment.eas, deployment.schemas.endorsement, {
    refUID: communityId,
    revocable: SCHEMAS.endorsement.revocable,
    data: encodeEndorsement({ slug, note }),
  })
}

/// Only the curator who gave a review can revoke it (an EAS rule).
export function removeEndorsement(client: PublicClient, wallet: Wallet, deployment: Deployment, endorsementUid: Hex) {
  return revoke(client, wallet, deployment.eas, deployment.schemas.endorsement, endorsementUid)
}
