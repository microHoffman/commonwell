// Shared helpers for the CLI scripts. Keys come from .env.local (Bun loads it automatically) or from
// Foundry keystores; the generated ones are testnet-only.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPublicClient, createWalletClient, fallback, http, type Hex, type PublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { chainFor, chainLabel, type Deployment, type Wallet } from '../packages/core/src/index.ts'
import { isTestnet, networkFor } from './networks.ts'

export const ROOT = join(import.meta.dir, '..')

export function option(name: string, fallbackValue?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallbackValue
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

export function deploymentName(): string {
  return option('deployment', 'hoodi-dev')!
}

/// RPC_URLS_<chainId> (comma-separated) overrides the deployment's, then the network's, public RPCs.
function rpcUrls(chainId: number, deployment?: Deployment): string[] {
  const configured = process.env[`RPC_URLS_${chainId}`]?.split(',').map((u) => u.trim()).filter(Boolean)
  if (configured?.length) return configured
  return deployment?.rpcUrls.length ? deployment.rpcUrls : networkFor(chainId).rpcUrls
}

const transport = (chainId: number, deployment?: Deployment) => fallback(rpcUrls(chainId, deployment).map((url) => http(url)))

export function publicClient(chainId: number, deployment?: Deployment): PublicClient {
  return createPublicClient({ chain: chainFor(chainId), transport: transport(chainId, deployment) }) as PublicClient
}

const keystoreVar = (keyName: string) => keyName.replace(/_KEY$/, '_KEYSTORE')

/// Whether a key is set, as NAME_KEY or as a keystore in NAME_KEYSTORE.
export function hasKey(keyName: string): boolean {
  return Boolean(process.env[keystoreVar(keyName)] || process.env[keyName])
}

const decrypted = new Map<string, Hex>()

/// Decrypts a Foundry keystore (`cast wallet import <name> --interactive`) with cast, which asks for
/// the password; CAST_UNSAFE_PASSWORD skips the prompt. KEYSTORE_DIR overrides ~/.foundry/keystores.
function keystoreKey(name: string): Hex {
  const cached = decrypted.get(name)
  if (cached) return cached
  console.error(`Unlocking keystore ${name}…`)
  const dir = process.env.KEYSTORE_DIR ? ['--keystore-dir', process.env.KEYSTORE_DIR] : []
  const result = Bun.spawnSync(['cast', 'wallet', 'decrypt-keystore', name, ...dir], {
    stdin: 'inherit',
    stdout: 'pipe',
    stderr: 'inherit',
  })
  const key = result.stdout.toString().match(/0x[0-9a-fA-F]{64}/)?.[0] as Hex | undefined
  if (result.exitCode !== 0 || !key) throw new Error(`Couldn't unlock keystore ${name}`)
  decrypted.set(name, key)
  return key
}

/// NAME_KEYSTORE (a Foundry keystore) wins over NAME_KEY (a raw key in .env.local). Off testnets
/// only keystores are accepted, so a generated testnet key can never sign there.
export function wallet(keyName: string, chainId: number, deployment?: Deployment): Wallet {
  const keystore = process.env[keystoreVar(keyName)]
  if (!keystore && !isTestnet(chainId)) {
    throw new Error(`${chainLabel(chainId)} needs ${keystoreVar(keyName)}: a Foundry keystore, not a key in .env.local`)
  }
  const key = keystore ? keystoreKey(keystore) : process.env[keyName]
  if (!key) throw new Error(`${keyName} is missing from .env.local; run \`bun run keys\` first`)
  return createWalletClient({
    account: privateKeyToAccount(key as Hex),
    chain: chainFor(chainId),
    transport: transport(chainId, deployment),
  })
}

const deploymentPath = (name: string) => join(ROOT, 'deployments', `${name}.json`)

export function readDeployment(name: string): Deployment | undefined {
  const path = deploymentPath(name)
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Deployment) : undefined
}

export function requireDeployment(name: string): Deployment {
  const deployment = readDeployment(name)
  if (!deployment) throw new Error(`deployments/${name}.json doesn't exist; run \`bun run deploy:core --deployment ${name}\``)
  return deployment
}

export function writeDeployment(deployment: Deployment) {
  mkdirSync(join(ROOT, 'deployments'), { recursive: true })
  writeFileSync(deploymentPath(deployment.name), `${JSON.stringify(deployment, null, 2)}\n`)
}

export function explorerTx(deployment: Pick<Deployment, 'explorer'>, hash: Hex): string {
  return `${deployment.explorer}/tx/${hash}`
}
