import type { Address, Chain, Hex } from 'viem'
import { hoodi, mainnet } from 'viem/chains'
import type { Unit } from './format.ts'

/// Addresses a vault type needs on one network. `asset`, `implementation` and `payoutTrigger` never
/// change once vaults exist, because every vault's CREATE2 address is derived from them.
export type KindConfig = {
  asset: Address
  implementation: Address
  payoutTrigger: Address
  /// One-transaction deposits (DepositRouter). Not part of any vault address, so it can be redeployed.
  depositRouter: Address
}

/// One deployment file in deployments/: everything the app and scripts need on one chain. Each is
/// self-contained (its own EAS records and vaults); the app reads several and merges their communities.
export type Deployment = {
  name: string
  chainId: number
  deployBlock: number
  create2Deployer: Address
  multicall3: Address
  eas: Address
  schemaRegistry: Address
  schemas: {
    community: Hex
    communityVault: Hex
    endorsement: Hex
  }
  kinds: Record<string, KindConfig>
  curators: Address[]
  explorer: string
  /// EAS explorer for this chain (e.g. https://easscan.org), where it has one. Without it, records
  /// link to the transaction that created them.
  easExplorer?: string
  /// Public RPCs, for the browser and the scripts unless overridden.
  rpcUrls: string[]
  faucets: { name: string; url: string }[]
}

export const CREATE2_DEPLOYER: Address = '0x4e59b44847b379578588920cA78FbF26c0B4956C'
export const MULTICALL3: Address = '0xcA11bde05977b3631167028862bE2a173976CA11'

const chains: Record<number, Chain> = { [hoodi.id]: hoodi, [mainnet.id]: mainnet }

export function chainFor(chainId: number): Chain {
  const chain = chains[chainId]
  if (!chain) throw new Error(`Unsupported chain ${chainId}`)
  return chain
}

/// "Hoodi testnet", "Ethereum": how the UI names a chain.
export function chainLabel(chainId: number): string {
  const chain = chainFor(chainId)
  return chain.testnet ? `${chain.name} testnet` : chain.name
}

/// The chain's own currency, which pays gas: ETH on Ethereum and Hoodi.
export function nativeUnit(chainId: number): Unit {
  const { symbol, decimals } = chainFor(chainId).nativeCurrency
  return { symbol, decimals }
}

/// Where a record can be inspected: its EAS explorer page, or else the transaction that created it.
export function attestationUrl(deployment: Deployment, uid: Hex, tx?: Hex): string | undefined {
  if (deployment.easExplorer) return `${deployment.easExplorer}/attestation/view/${uid}`
  return tx ? `${deployment.explorer}/tx/${tx}` : undefined
}

export function isCurator(deployment: Deployment, account: Address | undefined): boolean {
  if (!account) return false
  return deployment.curators.some((curator) => curator.toLowerCase() === account.toLowerCase())
}
