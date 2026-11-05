// Deploys what every community on a chain shares and writes deployments/<name>.json.
//
//   bun run deploy:core --deployment <name> [--chain hoodi|mainnet|<id>] [--kinds a,b] [--fresh] [--live]
//
// - The chain comes from --chain for a new deployment (default hoodi), else from the existing file.
// - Each vault type that supports the chain deploys its shared contracts (scripts/kinds/) through the
//   CREATE2 deployer with the zero salt, so they get the same address wherever their code and
//   arguments match. --kinds limits which types.
// - EAS: the chain's official one (scripts/networks.ts, or EAS_ADDRESS and SCHEMA_REGISTRY_ADDRESS),
//   else our own SchemaRegistry + EAS (Hoodi has none).
// - Re-runs reuse what the file already has; --fresh deploys a new EAS, which gives an empty directory.
// - A chain that isn't a testnet needs --live and DEPLOYER_KEYSTORE (a Foundry keystore), and the seed
//   curator is a curator only on testnets.
import { $ } from 'bun'
import { getAddress, zeroAddress, zeroHash, type Address, type Hex } from 'viem'
import {
  chainLabel,
  CREATE2_DEPLOYER,
  deployCreate2,
  easAbi,
  MULTICALL3,
  schemaRegistryAbi,
  SCHEMAS,
  schemaUid,
  type Deployment,
  type KindConfig,
  type SchemaName,
} from '../packages/core/src/index.ts'
import { easBytecode, schemaRegistryBytecode } from '../packages/core/src/generated/common.ts'
import { scriptKinds } from './kinds/index.ts'
import { deploymentName, flag, option, publicClient, readDeployment, ROOT, wallet, writeDeployment } from './lib.ts'
import { isTestnet, networkFor, parseChain } from './networks.ts'

const name = deploymentName()
const existing = readDeployment(name)
const chainOption = option('chain')
const chainId = chainOption ? parseChain(chainOption) : (existing?.chainId ?? parseChain('hoodi'))
if (existing && existing.chainId !== chainId) {
  throw new Error(`deployments/${name}.json is on chain ${existing.chainId}, not ${chainId}; pick another --deployment name`)
}
if (!isTestnet(chainId) && !flag('live')) {
  throw new Error(`${chainLabel(chainId)} isn't a testnet: pass --live, with your own deployer in DEPLOYER_KEYSTORE`)
}
const reuse = flag('fresh') ? undefined : existing
const network = networkFor(chainId)
const client = publicClient(chainId, existing)
const deployer = wallet('DEPLOYER_KEY', chainId, existing)
console.log(`Deploying ${name} on ${chainLabel(chainId)} as ${deployer.account.address}`)

async function create2(label: string, initCode: Hex): Promise<Address> {
  const { address, hash } = await deployCreate2(client, deployer, CREATE2_DEPLOYER, zeroHash, initCode)
  console.log(`${label.padEnd(16)} ${address}  ${hash ? `${network.explorer}/tx/${hash}` : '(already deployed)'}`)
  return address
}

const wanted = option('kinds')?.split(',').map((k) => k.trim())
const kindIds = Object.keys(scriptKinds).filter(
  (id) => scriptKinds[id as keyof typeof scriptKinds].supports(chainId) && (!wanted || wanted.includes(id)),
) as (keyof typeof scriptKinds)[]
if (kindIds.length === 0) throw new Error(`No vault type supports ${chainLabel(chainId)}${wanted ? ` among ${wanted.join(', ')}` : ''}`)
const kinds: Record<string, KindConfig> = {}
for (const id of kindIds) {
  console.log(`\n${id}`)
  kinds[id] = await scriptKinds[id].deployShared({ chainId, client, deployer, create2 })
}
console.log()

async function deployed(label: string, hash: Hex) {
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`${label} deployment failed (${hash})`)
  console.log(`${label.padEnd(16)} ${receipt.contractAddress}  ${network.explorer}/tx/${hash}`)
  return { address: getAddress(receipt.contractAddress), blockNumber: receipt.blockNumber }
}

const officialEas =
  process.env.EAS_ADDRESS && process.env.SCHEMA_REGISTRY_ADDRESS
    ? { eas: getAddress(process.env.EAS_ADDRESS), schemaRegistry: getAddress(process.env.SCHEMA_REGISTRY_ADDRESS) }
    : network.eas

let eas: Address
let schemaRegistry: Address
let deployBlock: number
if (reuse) {
  ;({ eas, schemaRegistry, deployBlock } = reuse)
  console.log(`EAS              ${eas}  (reused; --fresh for a new, empty directory)`)
} else if (officialEas) {
  ;({ eas, schemaRegistry } = officialEas)
  // The directory scan starts here: records from before this deployment aren't the app's.
  deployBlock = Number(await client.getBlockNumber())
  console.log(`EAS              ${eas}  (official)`)
} else {
  const registry = await deployed(
    'SchemaRegistry',
    await deployer.deployContract({ abi: schemaRegistryAbi, bytecode: schemaRegistryBytecode }),
  )
  schemaRegistry = registry.address
  eas = (await deployed('EAS', await deployer.deployContract({ abi: easAbi, bytecode: easBytecode, args: [schemaRegistry] }))).address
  deployBlock = Number(registry.blockNumber)
}

async function registerSchema(schema: SchemaName): Promise<Hex> {
  const uid = schemaUid(schema)
  const record = await client.readContract({ address: schemaRegistry, abi: schemaRegistryAbi, functionName: 'getSchema', args: [uid] })
  if (record.uid === zeroHash) {
    const hash = await deployer.writeContract({
      address: schemaRegistry,
      abi: schemaRegistryAbi,
      functionName: 'register',
      args: [SCHEMAS[schema].schema, zeroAddress, SCHEMAS[schema].revocable],
    })
    await client.waitForTransactionReceipt({ hash })
  }
  console.log(`schema ${schema.padEnd(15)} ${uid}`)
  return uid
}

// The seed curator reviews the demo communities, so it's a curator on testnets only.
const curators = [
  ...(isTestnet(chainId) ? [wallet('SEED_CURATOR_KEY', chainId).account.address] : []),
  ...(process.env.CURATOR_ADDRESSES ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => getAddress(a)),
]
if (curators.length === 0) console.warn('No curators: set CURATOR_ADDRESSES, or nothing can be reviewed')

const easExplorer = existing?.easExplorer ?? network.easExplorer
const deployment: Deployment = {
  name,
  chainId,
  deployBlock,
  create2Deployer: CREATE2_DEPLOYER,
  multicall3: MULTICALL3,
  eas,
  schemaRegistry,
  schemas: {
    community: await registerSchema('community'),
    communityVault: await registerSchema('communityVault'),
    endorsement: await registerSchema('endorsement'),
  },
  kinds,
  curators: [...new Set(curators)],
  explorer: network.explorer,
  ...(easExplorer ? { easExplorer } : {}),
  rpcUrls: existing?.rpcUrls ?? network.rpcUrls,
  faucets: network.faucets,
}
writeDeployment(deployment)
console.log(`\nWrote deployments/${name}.json (curators: ${deployment.curators.join(', ') || 'none'})`)

if (process.env.ETHERSCAN_API_KEY) {
  for (const id of kindIds) {
    for (const [address, contract, args] of scriptKinds[id].verifyTargets(kinds[id]!)) {
      await $`forge verify-contract --chain ${chainId} --watch --constructor-args ${args} ${address} ${contract}`
        .cwd(`${ROOT}/contracts`)
        .nothrow()
    }
  }
}
