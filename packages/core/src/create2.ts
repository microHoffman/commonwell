import {
  concat,
  getContractAddress,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem'

export type Wallet = WalletClient<Transport, Chain, Account>

export function create2Address(deployer: Address, salt: Hex, initCode: Hex): Address {
  return getContractAddress({ opcode: 'CREATE2', from: deployer, salt, bytecode: initCode })
}

export async function hasCode(client: PublicClient, address: Address): Promise<boolean> {
  const code = await client.getCode({ address })
  return code !== undefined && code !== '0x'
}

/// Deploys through the CREATE2 deployer, which takes `salt ‖ initCode`. Skips the deployment when the
/// computed address already has code, so re-running a half-finished flow is safe.
export async function deployCreate2(
  client: PublicClient,
  wallet: Wallet,
  deployer: Address,
  salt: Hex,
  initCode: Hex,
): Promise<{ address: Address; hash?: Hex }> {
  const address = create2Address(deployer, salt, initCode)
  if (await hasCode(client, address)) return { address }

  const hash = await wallet.sendTransaction({ to: deployer, data: concat([salt, initCode]) })
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success' || !(await hasCode(client, address))) {
    throw new Error(`CREATE2 deployment to ${address} failed (${hash})`)
  }
  return { address, hash }
}
