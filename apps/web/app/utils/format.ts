import { parseUnits } from 'viem'

const normalize = (text: string) => text.trim().replace(',', '.')
const decimalsOf = (value: string) => value.split('.')[1]?.length ?? 0

/// Parses a typed amount into base units with the token's decimals; undefined for anything that isn't a positive
/// number, or that has more decimals than the token (rounding it would send a different amount than typed).
export function parseAmount(text: string, decimals: number): bigint | undefined {
  const value = normalize(text)
  if (!/^(\d+\.?\d*|\.\d+)$/.test(value) || decimalsOf(value) > decimals) return undefined
  try {
    const amount = parseUnits(value, decimals)
    return amount > 0n ? amount : undefined
  } catch {
    return undefined
  }
}

/// Why `parseAmount` rejected a typed amount, for the field's error.
export function amountError(text: string, decimals: number): string {
  return decimalsOf(normalize(text)) > decimals ? `Use at most ${decimals} decimals` : 'Enter a number'
}

export function formatDate(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
