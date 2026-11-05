import { describe, expect, test } from 'bun:test'
import { formatAmount, lidoWstethV1, nativeUnit, sharedValueUnit, valueUnit } from '../src/index.ts'

describe('units', () => {
  test('a total has a unit only when every vault type shares it', () => {
    expect(sharedValueUnit([lidoWstethV1.id, lidoWstethV1.id])).toEqual({ symbol: 'ETH', decimals: 18 })
    expect(sharedValueUnit([lidoWstethV1.id, 'unknown-v1'])).toBeUndefined()
    expect(sharedValueUnit([])).toBeUndefined()
  })

  test('an unknown type has no symbol', () => {
    expect(valueUnit('unknown-v1')).toEqual({ symbol: '', decimals: 18 })
  })

  test("the chain's own currency", () => {
    expect(nativeUnit(1)).toEqual({ symbol: 'ETH', decimals: 18 })
  })

  test('amounts format with their own decimals', () => {
    expect(formatAmount(1_500_000n, 6)).toBe('1.5')
  })
})
