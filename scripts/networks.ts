// What the scripts need to know about each chain before a deployment file exists. Adding a chain:
// add it to `chains` in packages/core/src/config.ts and here, then `bun run deploy:core --chain <name>`.
import type { Address } from 'viem'
import { chainFor } from '../packages/core/src/index.ts'

export type Network = {
  /// Names accepted by --chain.
  names: string[]
  explorer: string
  easExplorer?: string
  rpcUrls: string[]
  faucets: { name: string; url: string }[]
  /// The chain's official EAS, when it has one. Without it, deploy:core deploys its own.
  eas?: { eas: Address; schemaRegistry: Address }
}

export const NETWORKS: Record<number, Network> = {
  560048: {
    names: ['hoodi'],
    explorer: 'https://hoodi.etherscan.io',
    rpcUrls: ['https://ethereum-hoodi-rpc.publicnode.com', 'https://rpc.hoodi.ethpandaops.io'],
    faucets: [
      { name: 'ethpandaops faucet', url: 'https://faucet.hoodi.ethpandaops.io' },
      { name: 'PoW faucet', url: 'https://hoodi-faucet.pk910.de' },
      { name: 'Google Cloud faucet', url: 'https://cloud.google.com/application/web3/faucet/ethereum/hoodi' },
    ],
  },
  1: {
    names: ['mainnet', 'ethereum'],
    explorer: 'https://etherscan.io',
    easExplorer: 'https://easscan.org',
    rpcUrls: ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com'],
    faucets: [],
    eas: { eas: '0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587', schemaRegistry: '0xA7b39296258348C78294F95B872b282326A97BDF' },
  },
}

export function networkFor(chainId: number): Network {
  const network = NETWORKS[chainId]
  if (!network) throw new Error(`The scripts don't know chain ${chainId}; add it to scripts/networks.ts`)
  return network
}

/// `--chain hoodi`, `--chain mainnet` or `--chain 560048`.
export function parseChain(value: string): number {
  const byName = Object.entries(NETWORKS).find(([, n]) => n.names.includes(value.toLowerCase()))
  const chainId = byName ? Number(byName[0]) : Number(value)
  networkFor(chainId)
  chainFor(chainId)
  return chainId
}

export function isTestnet(chainId: number): boolean {
  return chainFor(chainId).testnet === true
}
