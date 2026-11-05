import type { Address, Hex, PublicClient } from 'viem'
import type { KindConfig, Wallet } from '../../packages/core/src/index.ts'

export type DeployContext = {
  chainId: number
  client: PublicClient
  deployer: Wallet
  /// CREATE2 with the zero salt: the same address on every chain; skips contracts that exist.
  create2: (label: string, initCode: Hex) => Promise<Address>
}

/// What the scripts need from a vault type, next to its core module in packages/core/src/kinds/.
export type ScriptKind = {
  /// Whether this vault type can run on the chain (e.g. Lido vaults need wstETH with stEthPerToken()).
  supports(chainId: number): boolean
  /// Deploys, or finds, the contracts every vault of this type on the chain shares.
  deployShared(ctx: DeployContext): Promise<KindConfig>
  /// Contracts to verify on the explorer: address, forge contract path, ABI-encoded constructor args.
  verifyTargets(config: KindConfig): [Address, string, Hex][]
  /// The seed deposit: puts `amount` of ETH's worth into `vault` for the depositor.
  seedDeposit(args: { client: PublicClient; depositor: Wallet; vault: Address; config: KindConfig; amount: bigint }): Promise<{
    hash: Hex
    deposited: string
  }>
}
