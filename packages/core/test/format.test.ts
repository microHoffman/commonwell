import { describe, expect, test } from 'bun:test'
import { parseEther } from 'viem'
import { formatAmount, formatApprox, isValidSlug, safeHttpUrl, slugify } from '../src/index.ts'
import { assertFrozen, mergeAbis } from '../scripts/gen-contracts.ts'

describe('formatApprox', () => {
  test('rounds to 4 significant digits and hides dust', () => {
    expect(formatApprox(0n)).toBe('0')
    expect(formatApprox(parseEther('0.000000512308'))).toBe('< 0.0001')
    expect(formatApprox(parseEther('0.0012345'))).toBe('0.001235')
    expect(formatApprox(parseEther('2.123456'))).toBe('2.1235')
  })
})

describe('formatAmount', () => {
  test('keeps small payouts readable and large amounts short', () => {
    expect(formatAmount(0n)).toBe('0')
    expect(formatAmount(parseEther('0.0000523131'))).toBe('0.0000523131')
    expect(formatAmount(parseEther('0.00005231317'))).toBe('0.0000523132')
    expect(formatAmount(parseEther('12.3456789'))).toBe('12.3457')
    expect(formatAmount(1n)).toBe('0.000000000000000001')
  })
})

describe('short names', () => {
  test('3–32 lowercase letters, digits and inner hyphens; never an app route', () => {
    expect(isValidSlug('brussels')).toBe(true)
    expect(isValidSlug('ghent-2026')).toBe(true)
    for (const bad of ['me', 'c', 'new', 'ab', '-ab', 'ab-', 'Brussels', 'brü', 'a'.repeat(33), '_nuxt']) {
      expect(isValidSlug(bad)).toBe(false)
    }
  })

  test('are suggested from community names', () => {
    expect(slugify('Brussels Commons!')).toBe('brussels-commons')
    expect(slugify('Liège à vélo')).toBe('liege-a-velo')
    expect(isValidSlug(slugify('A very long community name that keeps going'))).toBe(true)
  })
})

describe('safeHttpUrl', () => {
  test('only http(s) links are rendered', () => {
    expect(safeHttpUrl('https://brussels.example/about')).toBe('https://brussels.example/about')
    expect(safeHttpUrl('http://brussels.example')).toBe('http://brussels.example/')
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hi', 'ipfs://cid', 'not a url', '']) {
      expect(safeHttpUrl(bad)).toBeUndefined()
    }
  })
})

describe('gen-contracts', () => {
  test('a frozen vault type refuses different bytecode', () => {
    expect(() => assertFrozen('t', { vaultBytecode: '0x01' }, { vaultBytecode: '0x01' })).not.toThrow()
    expect(() => assertFrozen('t', { vaultBytecode: '0x01' }, { vaultBytecode: '0x02' })).toThrow(/frozen/)
  })

  test('the vault ABI merges strategy and implementation without duplicates', () => {
    const fn = (name: string, inputs: string[] = []) => ({ type: 'function', name, inputs: inputs.map((type) => ({ type })) })
    const merged = mergeAbis(
      [{ type: 'constructor', inputs: [] }, fn('report'), fn('redeem', ['uint256', 'address', 'address'])],
      [fn('report'), fn('redeem', ['uint256', 'address', 'address', 'uint256'])],
    )
    expect(merged.map((i) => `${i.name}/${i.inputs?.length}`)).toEqual(['report/0', 'redeem/3', 'redeem/4'])
  })
})
