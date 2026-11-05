import type { Unit } from '../format.ts'
import { genericCopy, type KindCopy } from './copy.ts'
import * as lidoWstethV1 from './lido-wsteth-v1.ts'

/// Every vault type the app accepts. A type's code and addresses never change once vaults exist;
/// new Octant code is a new entry.
export const vaultKinds = {
  [lidoWstethV1.id]: lidoWstethV1,
} as const

export type VaultKindId = keyof typeof vaultKinds
export type VaultKind = (typeof vaultKinds)[VaultKindId]

export const DEFAULT_KIND: VaultKindId = lidoWstethV1.id

export function getKind(id: string): VaultKind | undefined {
  return Object.hasOwn(vaultKinds, id) ? vaultKinds[id as VaultKindId] : undefined
}

/// The wording for a vault type, or neutral wording for one this app doesn't know.
export function kindCopy(id: string): KindCopy {
  return getKind(id)?.copy ?? genericCopy
}

// A type this app doesn't know: no symbol, and its positions are read as 18-decimal values, like Lido's.
const UNKNOWN_UNIT: Unit = { symbol: '', decimals: 18 }

/// What a vault type's figures (deposits, positions, donations, payouts) are valued in.
export function valueUnit(id: string): Unit {
  return getKind(id)?.valueUnit ?? UNKNOWN_UNIT
}

/// What a vault type's vaults hold, and what their withdrawals pay out.
export function assetUnit(id: string): Unit {
  return getKind(id)?.assetUnit ?? UNKNOWN_UNIT
}

/// The unit a total over vaults of these types can be shown in: their shared value unit, or undefined when
/// they differ (or one is unknown), since such a total isn't one amount. ARCHITECTURE §9 plans USD for that case.
export function sharedValueUnit(ids: string[]): Unit | undefined {
  const units = ids.map((id) => getKind(id)?.valueUnit)
  const first = units[0]
  return first && units.every((u) => u?.symbol === first.symbol && u.decimals === first.decimals) ? first : undefined
}

export { lidoWstethV1 }
export type { FaqItem, KindCopy } from './copy.ts'
