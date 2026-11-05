// lido-wsteth-v1 in the scripts: shared contracts per chain, and how the seed deposits.
import { encodeAbiParameters, encodeDeployData, formatEther, parseAbiParameters, type Address } from 'viem'
import { approve, deposit, stakeEth } from '../../packages/core/src/index.ts'
import { depositRouterAbi, depositRouterBytecode } from '../../packages/core/src/generated/deposit-router.ts'
import { implementationBytecode, payoutTriggerBytecode } from '../../packages/core/src/generated/kinds/lido-wsteth-v1.ts'
import type { ScriptKind } from './types.ts'

/// Lido's wstETH per chain. Only L1 wstETH has stEthPerToken(), so L2s don't qualify.
const WSTETH: Record<number, Address> = {
  1: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  560048: '0x7E99eE3C66636DE415D2d7C880938F2f40f94De4',
}

const routerArgs = (wstETH: Address, payoutTrigger: Address) =>
  encodeAbiParameters(parseAbiParameters('address,address'), [wstETH, payoutTrigger])

export const lidoWstethV1: ScriptKind = {
  supports: (chainId) => chainId in WSTETH,

  async deployShared({ chainId, create2 }) {
    const asset = WSTETH[chainId]
    if (!asset) throw new Error(`lido-wsteth-v1 has no wstETH on chain ${chainId}`)
    const payoutTrigger = await create2('PayoutTrigger', payoutTriggerBytecode)
    const implementation = await create2('Implementation', implementationBytecode)
    const depositRouter = await create2(
      'DepositRouter',
      encodeDeployData({ abi: depositRouterAbi, bytecode: depositRouterBytecode, args: [asset, payoutTrigger] }),
    )
    return { asset, implementation, payoutTrigger, depositRouter }
  },

  verifyTargets: (config) => [
    [config.payoutTrigger, 'src/PayoutTrigger.sol:PayoutTrigger', '0x'],
    [
      config.implementation,
      'lib/octant-v2-core/src/strategies/yieldSkimming/YieldSkimmingTokenizedStrategy.sol:YieldSkimmingTokenizedStrategy',
      '0x',
    ],
    [config.depositRouter, 'src/DepositRouter.sol:DepositRouter', routerArgs(config.asset, config.payoutTrigger)],
  ],

  // Stakes ETH into wstETH, then approves and deposits it directly (the app uses the router instead).
  async seedDeposit({ client, depositor, vault, config, amount }) {
    const { received } = await stakeEth(client, depositor, config.asset, amount)
    await approve(client, depositor, config.asset, vault, received)
    const hash = await deposit(client, depositor, vault, received)
    return { hash, deposited: `${formatEther(received)} wstETH` }
  },
}
