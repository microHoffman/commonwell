// Depositor transactions and reads. Every amount is an integer in token units; formatting happens
// only in the UI.
import {
  encodeFunctionData,
  erc20Abi,
  isAddressEqual,
  parseAbi,
  parseEventLogs,
  parseSignature,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { MULTICALL3 } from './config.ts'
import type { Wallet } from './create2.ts'
import { depositRouterAbi } from './generated/deposit-router.ts'
import { vaultAbi } from './generated/kinds/lido-wsteth-v1.ts'
import { positionValue } from './kinds/lido-wsteth-v1.ts'

/// ETH → wstETH through wstETH's staking shortcut (sending ETH to the token). The amount received
/// is read from the mint in the receipt, never from a balance difference, so wstETH the user
/// already held is never swept into the deposit.
export async function stakeEth(client: PublicClient, wallet: Wallet, wstETH: Address, amount: bigint) {
  const hash = await wallet.sendTransaction({ to: wstETH, value: amount })
  return { hash, received: await stakedAmount(client, hash, wstETH, wallet.account.address) }
}

/// Reads a staking transaction's minted wstETH; also used to resume after a reload.
export async function stakedAmount(client: PublicClient, hash: Hex, wstETH: Address, user: Address): Promise<bigint> {
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Staking failed (${hash})`)
  const mint = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs }).find(
    (log) =>
      isAddressEqual(log.address, wstETH) && isAddressEqual(log.args.from, zeroAddress) && isAddressEqual(log.args.to, user),
  )
  if (!mint) throw new Error('No wstETH minted in this transaction')
  return mint.args.value
}

async function confirmed(client: PublicClient, hash: Hex, label: string): Promise<Hex> {
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`${label} failed (${hash})`)
  return hash
}

export async function approve(client: PublicClient, wallet: Wallet, token: Address, spender: Address, amount: bigint): Promise<Hex> {
  const hash = await wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'approve', args: [spender, amount] })
  await client.waitForTransactionReceipt({ hash })
  return hash
}

export async function deposit(client: PublicClient, wallet: Wallet, vault: Address, assets: bigint): Promise<Hex> {
  const hash = await wallet.writeContract({
    address: vault,
    abi: vaultAbi,
    functionName: 'deposit',
    args: [assets, wallet.account.address],
  })
  return confirmed(client, hash, 'Deposit')
}

/// ETH → wstETH → vault in one transaction through the DepositRouter. If the vault needs reopening
/// (everyone withdrew), the router does that in the same transaction.
export async function depositEthViaRouter(
  client: PublicClient,
  wallet: Wallet,
  router: Address,
  vault: Address,
  value: bigint,
): Promise<Hex> {
  const hash = await wallet.writeContract({ address: router, abi: depositRouterAbi, functionName: 'depositEth', args: [vault], value })
  return confirmed(client, hash, 'Deposit')
}

/// wstETH the user already approved to the router.
export async function depositWstEthViaRouter(
  client: PublicClient,
  wallet: Wallet,
  router: Address,
  vault: Address,
  assets: bigint,
): Promise<Hex> {
  const hash = await wallet.writeContract({
    address: router,
    abi: depositRouterAbi,
    functionName: 'depositWstEth',
    args: [vault, assets],
  })
  return confirmed(client, hash, 'Deposit')
}

const permitAbi = parseAbi(['function nonces(address owner) view returns (uint256)', 'function name() view returns (string)'])

export type Permit = { deadline: bigint; v: number; r: Hex; s: Hex }

/// EIP-2612 permit for `spender` to take exactly `value` wstETH. A gasless signature, not a transaction.
/// wstETH has no eip712Domain(); its domain version is "1" (checked against DOMAIN_SEPARATOR on Hoodi).
export async function signWstEthPermit(
  client: PublicClient,
  wallet: Wallet,
  wstETH: Address,
  spender: Address,
  value: bigint,
  deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60),
): Promise<Permit> {
  const owner = wallet.account.address
  const [name, nonce] = await Promise.all([
    client.readContract({ address: wstETH, abi: permitAbi, functionName: 'name' }),
    client.readContract({ address: wstETH, abi: permitAbi, functionName: 'nonces', args: [owner] }),
  ])
  const signature = await wallet.signTypedData({
    domain: { name, version: '1', chainId: wallet.chain.id, verifyingContract: wstETH },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    message: { owner, spender, value, nonce, deadline },
  })
  const { r, s, v, yParity } = parseSignature(signature)
  return { deadline, v: Number(v ?? BigInt(yParity + 27)), r, s }
}

export async function depositWstEthWithPermit(
  client: PublicClient,
  wallet: Wallet,
  router: Address,
  vault: Address,
  assets: bigint,
  permit: Permit,
): Promise<Hex> {
  const hash = await wallet.writeContract({
    address: router,
    abi: depositRouterAbi,
    functionName: 'depositWstEthWithPermit',
    args: [vault, assets, permit.deadline, permit.v, permit.r, permit.s],
  })
  return confirmed(client, hash, 'Deposit')
}

/// Whether the wallet can run several calls atomically behind one confirmation (EIP-5792). Wallets
/// that don't implement wallet_getCapabilities count as no.
export async function supportsAtomicBatch(wallet: Wallet): Promise<boolean> {
  try {
    const capabilities = await wallet.getCapabilities({ chainId: wallet.chain.id })
    const status = capabilities.atomic?.status
    return status === 'supported' || status === 'ready'
  } catch {
    return false
  }
}

/// approve + router deposit as one atomic EIP-5792 batch: one confirmation in wallets that support it.
export async function depositWstEthBatched(
  wallet: Wallet,
  wstETH: Address,
  router: Address,
  vault: Address,
  assets: bigint,
): Promise<void> {
  const { id } = await wallet.sendCalls({
    forceAtomic: true,
    calls: [
      { to: wstETH, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [router, assets] }) },
      { to: router, data: encodeFunctionData({ abi: depositRouterAbi, functionName: 'depositWstEth', args: [vault, assets] }) },
    ],
  })
  const result = await wallet.waitForCallsStatus({ id, timeout: 180_000 })
  if (result.status !== 'success' || result.receipts?.some((r) => r.status !== 'success')) {
    throw new Error(`Deposit failed (batch ${id})`)
  }
}

/// Partial withdrawal of `assets` wstETH. Always the 4-argument form with a 0% loss tolerance:
/// the 3-argument redeem would accept a 100% loss.
export async function withdraw(client: PublicClient, wallet: Wallet, vault: Address, assets: bigint): Promise<Hex> {
  const account = wallet.account.address
  const hash = await wallet.writeContract({
    address: vault,
    abi: vaultAbi,
    functionName: 'withdraw',
    args: [assets, account, account, 0n],
  })
  await client.waitForTransactionReceipt({ hash })
  return hash
}

/// Full withdrawal: redeems every share (no dust left behind).
export async function redeemAll(client: PublicClient, wallet: Wallet, vault: Address, shares: bigint): Promise<Hex> {
  const account = wallet.account.address
  const hash = await wallet.writeContract({
    address: vault,
    abi: vaultAbi,
    functionName: 'redeem',
    args: [shares, account, account, 0n],
  })
  await client.waitForTransactionReceipt({ hash })
  return hash
}

export type Position = {
  vault: Address
  shares: bigint
  /// wstETH the user can withdraw now.
  withdrawable: bigint
  /// The same amount valued in stETH (≈ ETH) at Lido's current rate.
  value: bigint
}

/// The user's positions in `vaults`, from share balances (so transferred shares count too).
export async function readPositions(client: PublicClient, user: Address, vaults: Address[]): Promise<Position[]> {
  if (vaults.length === 0) return []
  const balances = await client.multicall({
    contracts: vaults.map((vault) => ({ address: vault, abi: vaultAbi, functionName: 'balanceOf', args: [user] }) as const),
    allowFailure: true,
    multicallAddress: MULTICALL3,
  })
  const held = vaults
    .map((vault, i) => ({ vault, shares: balances[i]?.status === 'success' ? (balances[i].result as bigint) : 0n }))
    .filter((p) => p.shares > 0n)
  if (held.length === 0) return []
  const details = await client.multicall({
    contracts: held.flatMap(({ vault, shares }) => [
      { address: vault, abi: vaultAbi, functionName: 'previewRedeem', args: [shares] } as const,
      { address: vault, abi: vaultAbi, functionName: 'getCurrentExchangeRate' } as const,
    ]),
    allowFailure: true,
    multicallAddress: MULTICALL3,
  })
  return held.map(({ vault, shares }, i) => {
    const preview = details[2 * i]
    const rate = details[2 * i + 1]
    const withdrawable = preview?.status === 'success' ? (preview.result as bigint) : 0n
    const exchangeRate = rate?.status === 'success' ? (rate.result as bigint) : 0n
    return { vault, shares, withdrawable, value: positionValue(withdrawable, exchangeRate) }
  })
}

export async function readTokenState(client: PublicClient, token: Address, owner: Address, spender: Address) {
  const [balance, allowance] = await client.multicall({
    contracts: [
      { address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
      { address: token, abi: erc20Abi, functionName: 'allowance', args: [owner, spender] },
    ],
    allowFailure: false,
    multicallAddress: MULTICALL3,
  })
  return { balance, allowance }
}
