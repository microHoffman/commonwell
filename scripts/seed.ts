// Seeds a deployment with two reviewed demo communities and one deposit in each.
//
//   bun run seed --deployment <name>        (SEED_AMOUNT=<ETH> per deposit, default 0.01)
//
// Safe to re-run: salts are deterministic (CREATE2 skips existing contracts) and records that
// already exist in the directory are reused. Testnets only. Vaults are the app's default type, like
// the create wizard's, and the seed deposit comes from that type's module in scripts/kinds/.
import { encodePacked, formatEther, keccak256, parseEther, type Address } from 'viem'
import {
  chainLabel,
  createCommunity,
  DEFAULT_KIND,
  endorse,
  getKind,
  loadDirectory,
  readPositions,
  validateCommunity,
  type Profile,
  type VaultKindId,
  type Wallet,
} from '../packages/core/src/index.ts'
import { scriptKinds } from './kinds/index.ts'
import { deploymentName, explorerTx, publicClient, requireDeployment, wallet } from './lib.ts'
import { isTestnet } from './networks.ts'

const deployment = requireDeployment(deploymentName())
const { chainId } = deployment
if (!isTestnet(chainId)) throw new Error(`${chainLabel(chainId)} isn't a testnet; the seed only makes demo data on testnets`)
const kindId: VaultKindId = DEFAULT_KIND
const kindConfig = deployment.kinds[kindId]
if (!getKind(kindId) || !kindConfig) throw new Error(`Vault type ${kindId} isn't deployed in ${deployment.name}`)
const client = publicClient(chainId, deployment)
const signer = (key: string) => wallet(key, chainId, deployment)
const funder = signer('DEPLOYER_KEY')
const curator = signer('SEED_CURATOR_KEY')
const depositor = signer('DEPOSITOR_KEY')
const seedAmount = parseEther(process.env.SEED_AMOUNT ?? '0.01')

const seeds: { admin: Wallet; treasury: Address; slug: string; profile: Profile }[] = [
  {
    admin: signer('ADMIN_A_KEY'),
    treasury: signer('TREASURY_A_KEY').account.address,
    slug: 'community-a',
    profile: {
      name: 'Community A',
      description: 'Demo community. Its staking yield funds neighbourhood projects.',
      website: 'https://example.org/community-a',
      imageURI: '',
    },
  },
  {
    admin: signer('ADMIN_B_KEY'),
    treasury: signer('TREASURY_B_KEY').account.address,
    slug: 'community-b',
    profile: {
      name: 'Community B',
      description: 'Demo community. Its staking yield funds an open-source maintainer.',
      website: 'https://example.org/community-b',
      imageURI: '',
    },
  },
]

async function topUp(account: Address, minimum: bigint) {
  const balance = await client.getBalance({ address: account })
  if (balance >= minimum) return
  const hash = await funder.sendTransaction({ to: account, value: minimum - balance })
  await client.waitForTransactionReceipt({ hash })
  console.log(`funded ${account} with ${formatEther(minimum - balance)} ETH`)
}

const gas = parseEther('0.02')
await topUp(curator.account.address, parseEther('0.005'))
await topUp(depositor.account.address, 2n * seedAmount + gas)
for (const seed of seeds) await topUp(seed.admin.account.address, gas)

let directory = await loadDirectory(client, deployment)
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

for (const seed of seeds) {
  const owner = seed.admin.account.address
  const existing = directory.communities.find((c) => same(c.owner, owner) && c.profile.name === seed.profile.name)
  await createCommunity(
    client,
    seed.admin,
    deployment,
    { profile: seed.profile, treasury: seed.treasury },
    {
      // Per deployment, so the dev and demo deployments never share seeded vaults.
      salt: keccak256(encodePacked(['address', 'string', 'string'], [owner, 'seed', deployment.name])),
      communityId: existing?.id,
      linkUid: existing?.vaults.find((v) => !v.retired)?.uid,
      hashes: {},
    },
    { onStep: (step) => console.log(`${seed.profile.name}: ${step}`) },
  )
}

directory = await loadDirectory(client, deployment)
for (const seed of seeds) {
  const community = directory.communities.find((c) => same(c.owner, seed.admin.account.address) && c.profile.name === seed.profile.name)!
  if (!community.endorsement) {
    const { hash } = await endorse(client, curator, deployment, community.id, seed.slug, 'Seeded demo community')
    console.log(`${seed.profile.name}: reviewed as /${seed.slug}  ${explorerTx(deployment, hash)}`)
  }

  const view = await validateCommunity(client, community, deployment)
  if (!view.active[0]) throw new Error(`${seed.profile.name}: no valid vault (${view.vaultViews.flatMap((v) => v.problems).join('; ')})`)
  const vault = view.active[0].vault
  const [position] = await readPositions(client, depositor.account.address, [vault])
  if (position) {
    console.log(`${seed.profile.name}: depositor already holds ${formatEther(position.value)} ETH of staked value`)
    continue
  }
  const { hash, deposited } = await scriptKinds[kindId].seedDeposit({ client, depositor, vault, config: kindConfig, amount: seedAmount })
  console.log(`${seed.profile.name}: deposited ${deposited}  ${explorerTx(deployment, hash)}`)
}
console.log('\nSeeded. Payouts appear after the next Lido report: `bun run payout` or "Send all payouts" in the app.')
