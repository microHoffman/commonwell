import { pad, zeroHash, type Address, type Hex } from 'viem'
import {
  create2Address,
  CREATE2_DEPLOYER,
  MULTICALL3,
  schemaUid,
  type Attestation,
  type Deployment,
} from '../src/index.ts'
import { implementationBytecode, payoutTriggerBytecode } from '../src/generated/kinds/lido-wsteth-v1.ts'

export const WSTETH: Address = '0x7E99eE3C66636DE415D2d7C880938F2f40f94De4'
export const owner: Address = '0x0000000000000000000000000000000000002222'
export const stranger: Address = '0x0000000000000000000000000000000000003333'
export const curator: Address = '0x0000000000000000000000000000000000004444'
export const treasury: Address = '0x0000000000000000000000000000000000001111'

export const deployment: Deployment = {
  name: 'test',
  chainId: 560048,
  deployBlock: 0,
  create2Deployer: CREATE2_DEPLOYER,
  multicall3: MULTICALL3,
  eas: '0x00000000000000000000000000000000000E0A55',
  schemaRegistry: '0x0000000000000000000000000000000000005c4e',
  schemas: {
    community: schemaUid('community'),
    communityVault: schemaUid('communityVault'),
    endorsement: schemaUid('endorsement'),
  },
  kinds: {
    'lido-wsteth-v1': {
      asset: WSTETH,
      implementation: create2Address(CREATE2_DEPLOYER, zeroHash, implementationBytecode),
      payoutTrigger: create2Address(CREATE2_DEPLOYER, zeroHash, payoutTriggerBytecode),
      depositRouter: '0x000000000000000000000000000000000000d3a0',
    },
  },
  curators: [curator],
  explorer: 'https://hoodi.etherscan.io',
  rpcUrls: [],
  faucets: [],
}

let next = 0
export function uid(): Hex {
  next += 1
  return pad(`0x${next.toString(16)}`)
}

export function att(fields: Partial<Attestation> & Pick<Attestation, 'schema' | 'data'>): Attestation {
  return {
    uid: uid(),
    time: BigInt(next),
    expirationTime: 0n,
    revocationTime: 0n,
    refUID: zeroHash,
    recipient: '0x0000000000000000000000000000000000000000',
    attester: owner,
    revocable: true,
    ...fields,
  }
}
