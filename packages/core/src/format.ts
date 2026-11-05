import { formatUnits, type Address } from 'viem'

/// What an amount is counted in: its symbol, and the decimals its bigint base units use (18 for ETH, 6 for USDC).
export type Unit = { symbol: string; decimals: number }

/// Display-only formatting: up to `significant` digits below 1, at most 4 decimals above.
export function formatAmount(value: bigint, decimals = 18, significant = 6): string {
  if (value === 0n) return '0'
  const n = Number(formatUnits(value, decimals))
  const options: Intl.NumberFormatOptions =
    Math.abs(n) < 1 ? { maximumSignificantDigits: significant } : { maximumFractionDigits: 4 }
  return new Intl.NumberFormat('en-US', options).format(n)
}

/// For headline figures: 4 significant digits, and dust shown as "< 0.0001" rather than 0.000000512308.
export function formatApprox(value: bigint, decimals = 18): string {
  if (value === 0n) return '0'
  if (Number(formatUnits(value, decimals)) < 0.0001) return '< 0.0001'
  return formatAmount(value, decimals, 4)
}

/// An APR given in percent (2.4 → "2.4%").
export function formatPercent(percent: number): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(percent)}%`
}

/// Roughly what `value` earns in a year at `percent` APR. Basis-point precision is plenty for an estimate.
export function yearlyYield(value: bigint, percent: number): bigint {
  return (value * BigInt(Math.round(percent * 100))) / 10_000n
}

export function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/// Short names (the "brussels" in /brussels): 3–32 lowercase letters, digits and inner hyphens,
/// and never an app route.
export const RESERVED_SLUGS = ['me', 'new', 'c'] as const
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !(RESERVED_SLUGS as readonly string[]).includes(slug)
}

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '')
}

/// Profile links are typed in by anyone who registers: only http(s) URLs are ever rendered.
export function safeHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

export function timeAgo(seconds: bigint | number, now = Date.now() / 1000): string {
  const elapsed = Math.max(0, now - Number(seconds))
  const units: [number, string][] = [
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ]
  for (const [size, unit] of units) {
    const count = Math.floor(elapsed / size)
    if (count >= 1) return `${count} ${unit}${count === 1 ? '' : 's'} ago`
  }
  return 'just now'
}
