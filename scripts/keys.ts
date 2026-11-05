// Generates the testnet-only keys the scripts use and appends them to .env.local (never overwrites),
// then shows their balances on --chain (default hoodi).
//
//   bun run keys [--chain hoodi|<id>]
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatEther, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { chainLabel } from '../packages/core/src/index.ts'
import { option, publicClient, ROOT } from './lib.ts'
import { networkFor, parseChain } from './networks.ts'

const chainId = parseChain(option('chain', 'hoodi')!)

const KEYS = [
  ['DEPLOYER_KEY', 'pays for deployments and funds the other seed accounts'],
  ['SEED_CURATOR_KEY', 'reviews the seeded communities'],
  ['ADMIN_A_KEY', 'owns Community A'],
  ['ADMIN_B_KEY', 'owns Community B'],
  ['TREASURY_A_KEY', "receives Community A's payouts"],
  ['TREASURY_B_KEY', "receives Community B's payouts"],
  ['DEPOSITOR_KEY', 'makes the seed deposits'],
] as const

const path = join(ROOT, '.env.local')
const existing = existsSync(path) ? readFileSync(path, 'utf8') : ''
const added = KEYS.filter(([name]) => !new RegExp(`^${name}=`, 'm').test(existing))

if (added.length > 0) {
  const lines = added.map(([name, purpose]) => `# ${purpose}\n${name}=${generatePrivateKey()}`)
  const header = existing ? '\n' : '# Testnet-only keys for the Yield Forward scripts. Never use them on mainnet.\n'
  appendFileSync(path, `${header}${lines.join('\n')}\n`)
  console.log(`Added ${added.map(([name]) => name).join(', ')} to .env.local`)
}

const env = Object.fromEntries(
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => line.split('=', 2) as [string, string]),
)
const client = publicClient(chainId)
for (const [name, purpose] of KEYS) {
  const address = privateKeyToAccount(env[name] as Hex).address
  const balance = await client.getBalance({ address })
  console.log(`${name.padEnd(17)} ${address}  ${formatEther(balance).padStart(10)} ETH  (${purpose})`)
}
const faucets = networkFor(chainId).faucets.map((f) => f.url).join(', ')
console.log(`\nFund DEPLOYER_KEY with ${chainLabel(chainId)} ETH${faucets ? ` (${faucets})` : ''};`)
console.log('`bun run seed` sends the other accounts what they need from it.')
