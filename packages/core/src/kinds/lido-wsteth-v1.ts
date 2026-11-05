// Vault type lido-wsteth-v1: Octant 1.3.0 LidoStrategy (yield skimming) on Lido wstETH,
// paired with a YieldForwarder whose keeper is the PayoutTrigger.
import {
  decodeAbiParameters,
  encodeAbiParameters,
  encodeDeployData,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem'
import type { KindConfig } from '../config.ts'
import type { Unit } from '../format.ts'
import { create2Address } from '../create2.ts'
import type { KindCopy } from './copy.ts'
import { forwarderAbi, forwarderBytecode, vaultBytecode, vaultDeployAbi } from '../generated/kinds/lido-wsteth-v1.ts'

export const id = 'lido-wsteth-v1'
export const label = 'Lido wstETH (Octant LidoStrategy)'
/// Short name of where deposits earn, for page copy that names several types ("Lido and Sky").
export const protocol = 'Lido'
/// What the vault holds, and what withdrawals pay out.
export const assetUnit: Unit = { symbol: 'wstETH', decimals: 18 }
/// What the type's figures are valued in: deposits, positions, donations and payouts are wstETH at Lido's rate, in ETH.
export const valueUnit: Unit = { symbol: 'ETH', decimals: 18 }
/// The smallest deposit, in the token deposited: below it a deposit can round to unrecoverable dust.
export const minDeposit = '0.0001'

export const copy: KindCopy = {
  earning: 'Staked with Lido',
  rateLabel: 'Staking APR',
  yieldNoun: 'staking rewards',
  assetDescription: "Lido's staked ETH",
  depositOptions: {
    eth: { symbol: 'ETH', description: 'Staked with Lido for you' },
    wsteth: { symbol: 'wstETH', description: 'Already staked with Lido' },
  },
  yieldCadence: "Rewards build up with Lido's daily update.",
  recovery: "Lido's rate recovers",
  howItWorks: (name) => [
    `Your ETH is staked with Lido in ${name}'s vault.`,
    `The staking rewards are paid out to ${name}.`,
    'You keep your deposit and can withdraw it anytime.',
  ],
  faq: (name, rate) => ({
    funding: {
      label: `How does my deposit fund ${name}?`,
      content: `Your ETH is staked with Lido and held in ${name}'s vault, an Octant vault. Lido's staking rewards make staked ETH worth a little more every day. The vault keeps your deposit at the value you put in and passes everything it gains on to ${name}'s treasury.`,
    },
    asset: {
      label: 'Why do I get wstETH back instead of ETH?',
      content:
        "The vault holds wstETH, Lido's staked ETH, and withdrawals pay it out directly. You get fewer wstETH than you put in, worth the same ETH, because each wstETH has grown in value. You can keep it, swap it, or unstake it through Lido.",
    },
    receives: {
      label: `How much does ${name} receive?`,
      content: `Lido's staking APR on everything deposited, ${rate ?? 'which Lido publishes daily'}. Rewards build up with Lido's daily update, and anyone can then send them to ${name}.`,
    },
    loss: {
      label: "What if Lido's rate drops?",
      content:
        "It rarely does, for example after penalties on Lido's validators. While the vault is worth less than its deposits, payouts and new deposits pause until the rate recovers, and a withdrawal is worth slightly less than you put in.",
    },
  }),
  risks:
    "Your deposit relies on Lido's and Octant's contracts, and on this app's deposit router, working as intended. Lido's staked ETH can lose value if its validators are penalized.",
}
/// The pinned Octant code this type's frozen bytecode is built from.
export const sourceUrl = 'https://github.com/golemfoundation/octant-v2-core/tree/06ae2b9fa2e4443a3d9f6148498d4ada4f9861e8'
/// Deposits accept ETH (converted through wstETH's staking shortcut) or wstETH.
export const depositRoutes = ['eth', 'wsteth'] as const
/// Anyone may send payouts: redemptions never pull funds from elsewhere, so the trigger's 0% loss
/// tolerance can't be abused.
export const payoutPolicy = 'public' as const

/// Constructor settings stored in the vault link's `params`.
export type Params = {
  treasury: Address
  emergencyAdmin: Address
  vaultName: string
  vaultSymbol: string
}

const paramsAbi = parseAbiParameters('address treasury,address emergencyAdmin,string vaultName,string vaultSymbol')

export function encodeParams(p: Params): Hex {
  return encodeAbiParameters(paramsAbi, [p.treasury, p.emergencyAdmin, p.vaultName, p.vaultSymbol])
}

export function decodeParams(params: Hex): Params {
  const [treasury, emergencyAdmin, vaultName, vaultSymbol] = decodeAbiParameters(paramsAbi, params)
  return { treasury, emergencyAdmin, vaultName, vaultSymbol }
}

export type Contract = { address: Address; initCode: Hex }

/// Rebuilds both contracts' init code and CREATE2 addresses from the link settings. Validation
/// compares the vault address with the link's recipient; the wizard uses the same code to deploy.
export function buildContracts(
  p: Params,
  owner: Address,
  kind: KindConfig,
  deployer: Address,
  salt: Hex,
): { forwarder: Contract; vault: Contract } {
  const forwarderInit = encodeDeployData({
    abi: forwarderAbi,
    bytecode: forwarderBytecode,
    args: [p.treasury, kind.payoutTrigger],
  })
  const forwarder = create2Address(deployer, salt, forwarderInit)
  const vaultInit = encodeDeployData({
    abi: vaultDeployAbi,
    bytecode: vaultBytecode,
    // asset, name, symbol, management, keeper, emergencyAdmin, donationAddress, enableBurning, implementation
    args: [kind.asset, p.vaultName, p.vaultSymbol, owner, forwarder, p.emergencyAdmin, forwarder, false, kind.implementation],
  })
  return {
    forwarder: { address: forwarder, initCode: forwarderInit },
    vault: { address: create2Address(deployer, salt, vaultInit), initCode: vaultInit },
  }
}

/// A depositor's stETH value: what they can withdraw, valued at Lido's current rate.
/// Never shares × totalAssets / totalSupply, which would include yield not yet paid out.
export function positionValue(withdrawable: bigint, exchangeRate: bigint): bigint {
  return (withdrawable * exchangeRate) / 10n ** 18n
}

/// Lido's own APR API, per chain. The vault donates exactly what Lido's rate adds to its deposits,
/// so its yield is Lido's staking APR.
const LIDO_API: Record<number, string> = {
  1: 'https://eth-api.lido.fi',
  560048: 'https://eth-api-hoodi.testnet.fi',
}

export const aprSource = "Lido's 7-day average"

/// stETH's 7-day average APR in percent (e.g. 2.4), or undefined where Lido has no API.
export async function fetchApr(chainId: number): Promise<number | undefined> {
  const base = LIDO_API[chainId]
  if (!base) return undefined
  const response = await fetch(`${base}/v1/protocol/steth/apr/sma`)
  if (!response.ok) throw new Error(`Lido APR API: ${response.status}`)
  const body = (await response.json()) as { data?: { smaApr?: unknown } }
  const apr = body.data?.smaApr
  return typeof apr === 'number' && Number.isFinite(apr) ? apr : undefined
}
