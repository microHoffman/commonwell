import { chainFor, getKind, shortAddress, valueUnit, type VaultView } from '@commonwell/core'

/// Where a vault earns, as the page names it: "Lido".
export function protocolOf(view: VaultView): string {
  return getKind(view.link.kind)?.protocol ?? view.link.kind
}

/// A token's one-character mark: Ξ for ETH and its staked forms, $ for dollars, else the symbol's first letter.
export function tokenGlyph(symbol: string): string {
  return /ETH$/i.test(symbol) ? 'Ξ' : /^(USD|DAI)/i.test(symbol) ? '$' : symbol.charAt(0)
}

/// What a vault takes and where: "ETH on Ethereum". `short` names a testnet without "testnet", for a second line that says it.
export function vaultTitle(view: VaultView, short = false): string {
  const chain = chainFor(view.chainId)
  return `${valueUnit(view.link.kind).symbol} on ${short || !chain.testnet ? chain.name : `${chain.name} testnet`}`
}

/// The address, when another vault in `all` shares this one's network and protocol, so the two can be told apart.
export function twinAddress(view: VaultView, all: VaultView[]): string | undefined {
  const twin = all.some((o) => o !== view && o.chainId === view.chainId && protocolOf(o) === protocolOf(view))
  return twin ? shortAddress(view.vault) : undefined
}
