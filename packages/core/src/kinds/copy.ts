/// Page wording that depends on the vault type, so components never name a protocol themselves.
export type KindCopy = {
  /// The community's details line when all its vaults are this type: "Staked with Lido" (on Hoodi testnet).
  earning: string
  /// The stats label for the yearly rate.
  rateLabel: string
  /// What the yield is called in running text: "its staking rewards".
  yieldNoun: string
  /// What the vault holds, after its symbol: "wstETH, Lido's staked ETH".
  assetDescription: string
  /// The deposit form's options, by deposit route ("eth", "wsteth"): the token's symbol and a short line under it.
  depositOptions: Record<string, { symbol: string; description: string }>
  /// When new yield shows up, for "nothing to pay out yet".
  yieldCadence: string
  /// What ends a loss pause: "until Lido's rate recovers".
  recovery: string
  /// "How it works", three short steps.
  howItWorks: (name: string) => string[]
  /// The type's questions, placed among the general ones. `rate` is the live APR text, when loaded.
  faq: (name: string, rate?: string) => {
    funding: FaqItem
    asset?: FaqItem
    receives: FaqItem
    loss?: FaqItem
  }
  /// The type's own risks, the start of "What are the risks?".
  risks: string
  /// Fees the protocol takes, for "What does it cost me?", when it takes any.
  fees?: string
}

export type FaqItem = { label: string; content: string }

/// For vaults of a type this app doesn't know: never listed, but their positions stay withdrawable.
export const genericCopy: KindCopy = {
  earning: 'Earning yield',
  rateLabel: 'APR',
  yieldNoun: 'yield',
  assetDescription: 'what the vault holds',
  depositOptions: {},
  yieldCadence: 'Yield builds up over time.',
  recovery: "the vault's value recovers",
  howItWorks: (name) => [
    `Your deposit earns yield in ${name}'s vault.`,
    `The yield is paid out to ${name}.`,
    'You keep your deposit and can withdraw it anytime.',
  ],
  faq: (name) => ({
    funding: {
      label: `How does my deposit fund ${name}?`,
      content: `Your deposit is held in ${name}'s vault, which earns yield on it. The vault keeps your deposit at the value you put in and passes everything it gains on to ${name}'s treasury.`,
    },
    receives: {
      label: `How much does ${name} receive?`,
      content: `The yield on everything deposited. The deposit form shows what your amount would send in a year.`,
    },
  }),
  risks: "Your deposit relies on the vault's contracts, and on this app's deposit router, working as intended.",
}
