import { describe, expect, test } from 'bun:test'
import { pad } from 'viem'
import { create2Address, planVault } from '../src/index.ts'
import { deployment, owner, treasury } from './fixtures.ts'

describe('CREATE2 addresses', () => {
  test('match the EIP-1014 reference vector', () => {
    expect(create2Address('0x0000000000000000000000000000000000000000', pad('0x0'), '0x00')).toBe(
      '0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38',
    )
  })

  // Same inputs as contracts/test/Wiring.t.sol test_create2AddressesMatchTheApp.
  test('match what Solidity computes from the same frozen code', () => {
    const kind = deployment.kinds['lido-wsteth-v1']!
    expect(kind.implementation).toBe('0x658481F96384B6274FA4cA69D2CFEA251F477C28')
    expect(kind.payoutTrigger).toBe('0xF528D6a0e1361d0d68b4f6a390DB70e460e3D985')
    const plan = planVault(
      deployment,
      owner,
      { treasury, emergencyAdmin: owner, vaultName: 'Vector', vaultSymbol: 'cyWSTETH' },
      pad('0x01'),
    )
    expect(plan.forwarder.address).toBe('0x2007c22c03B265AC16d57E52860A6471e0f5884A')
    expect(plan.vault.address).toBe('0x36feBc4E9d1cb50902285bC502c0BA0B8E7E6134')
  })
})
