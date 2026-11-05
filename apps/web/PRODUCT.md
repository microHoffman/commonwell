# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Depositors** are the primary users, in two groups that count equally:

- **People close to a community** (for Commons Hub Brussels, its members and neighbours) who may never have held crypto. They sign in with a social login and get an embedded wallet.
- **Crypto-native supporters** who already hold the vault's asset (ETH or wstETH for the Lido type) and want its yield to fund something. They read addresses, roles and records before they deposit.

Their job: find a community, check that it is what it says, deposit, see their position, and withdraw later. Every flow has to work for a first-timer without any crypto vocabulary. A crypto-native user must find every fact they would check, and nothing should talk down to them.

Other roles:

- **Community owners** create a community (profile, treasury, network; four wallet confirmations, resumable after a reload) and edit its profile. The owner manages the vault.
- **Curators** review communities, which gives them the "Reviewed" label and a short URL. They can also send every pending payout at once.
- **Anyone** can send a community's payout. This is public housekeeping, not the main flow.

## Product Purpose

Commonwell lets people fund a community with the yield on money they keep. You deposit into the community's vault and hold your position as vault shares. You can withdraw the same value at any time, and the vault's yield goes to the community's treasury.

It runs on the Hoodi testnet today. Ethereum mainnet is next, and it will be the first deployment with real users and real money. Success means people trust it with real funds: they understand what they keep, what the community receives and how to get out, and they can always get their deposit back.

## Positioning

You give the yield and keep the deposit, and every claim the app makes can be checked:

- Vaults are **unmodified Octant v1.3.0** contracts. The app checks each vault on every page load: it recomputes the vault's CREATE2 address from the link's settings and the frozen code, then reads the live roles. Vaults that fail the check aren't listed, but their deposits stay withdrawable.
- **No server and no keys.** It's a static site: reads go from the browser to the chain, and the user's wallet signs every write. Anyone can send payouts through a public contract that can only pay the community's treasury.
- Communities are **public EAS records**. A curator review is a public statement that the curator vouches for who runs the community, nothing more.

## Operating Context

- **Separate sites per money type (decided).** The mainnet site lists only mainnet vaults, so everything on it is real money. Testnets get their own demo site, which keeps the faucet links and test-money wording.
- **Sign-in:** a social login (Web3Auth / MetaMask Embedded Wallets) or the user's own wallet. ETH deposits take one confirmation. wstETH deposits take one, plus a permit signature unless the router is already approved or the wallet batches.
- **Sharing:** a reviewed community gets a short URL (for example `/brussels`), and an unreviewed one is reached at `/c/<id>`.
- **Live chain data:** an RPC can be slow or unavailable ("Couldn't read <network>"). APR comes from the vault type's source, for Lido the 7-day average from Lido's API. Lido-type yield shows up after Lido's daily rate update.
- **Devices:** every flow has to work on a phone and on a desktop.

## Capabilities and Constraints

**Surfaces:** community list (`/`), community page (`/<short-name>`, `/c/<id>`), Create (`/new`), My deposits (`/me`), the curator review dialog and the account menu.

**Any chain, any vault type.** Nothing outside a deployment file or a vault-type module may assume a chain or an asset (ARCHITECTURE §9).
- Each chain offers its own vault types, and each type takes its own asset. Lido and ETH are the first case, not the default.
- A community can have several vaults, on one network or several. The community page shows one tab per vault (a select past four), and each tab names only what tells the vaults apart: network, then protocol, then address.
- Wording that depends on the type lives in the type module (`packages/core/src/kinds/copy.ts` and the type's `copy`), never in components. An unknown type falls back to neutral wording.
- Units and wording already come from the type and the chain. These are the type's value unit (`valueUnit`), its asset (`assetUnit`), its deposit options (`copy.depositOptions`), its minimum deposit, and the chain's own currency (`nativeUnit`). A unit carries its decimals with its symbol, so a 6-decimal asset displays and parses correctly.
- Known gap: the deposit and withdraw mechanics are still Lido's own and move behind the type with the second vault type. These are the deposit routes, the balances query, position valuation, and withdrawal conversion (Lido's 1e18-scaled exchange rate).

**Amounts** (AGENTS.md, binding):
- Keep values as `bigint` base units end to end, each with its unit's decimals; use floats only inside the formatters in `packages/core/src/format.ts`.
- Render every amount with `<TokenAmount>`, which shows the exact value on hover. Headline figures add `approx`.
- Inputs and their Max button use exact values. Only button labels and toasts may use `formatAmount` directly.

**Totals across assets:**
- Totals go by each vault type's value unit, not its token. A total over one unit stays in that unit: Lido and any other ETH-valued type total in ETH, with no price needed.
- A total over several units shows as one approximate USD value. Its tooltip lists each vault's exact amount in its own asset.
- If a price can't be loaded, the total falls back to the per-asset amounts, never a partial USD figure.
- Only these totals are converted.
- **Price source (decided): Chainlink feeds, read on-chain.**
  - One feed per value unit (ETH/USD first), always read on Ethereum mainnet.
  - The price sits behind one core function, so the source can change.
  - Testnet sites show no USD.
  - It gets built when the first type with a different value unit arrives.

**Flow facts:**
- Every deposit is one router transaction, and a failed one changes nothing. The minimum deposit is 0.0001. Max leaves gas on the native asset.
- Withdrawals return the same value as the deposit, paid in the vault's asset. For Lido that means fewer wstETH than you put in, worth the same ETH.
- **Withdrawals pay out the vault's own asset, which each vault type sets (decided for the mainnet launch).** Nothing is converted back to the token deposited. A Lido vault pays out wstETH, so someone who deposits ETH gets wstETH back, and another type pays out its own asset. The community page says so before the deposit, in the type's How it works step beside the deposit form (for Lido: "paid out in wstETH"). The FAQ explains what to do with it (for Lido: keep it, swap it, or unstake it through Lido).

**States the UI must carry:** Unreviewed, Not taking deposits, Payout address change pending, Loss pause, Nothing to pay out yet, Network unavailable, and vaults that are retired or fail the check (missing from the community page, still withdrawable under My deposits). Warnings are for states that change a depositor's decision.

**Terminology in the UI:** community, vault, deposit, position, payout, treasury, network (not "chain"), Reviewed / Unreviewed, curator, owner, automatic check, short name, "Pay out", "Generated", "My deposits".

**Language and access:** English only, with no i18n planned. No formal accessibility standard has been set.

**Open decisions:**
- The product name (see Brand Commitments).
- An owner "Add vault" action, which comes with the second vault type.
- Deferred until after the mainnet launch: withdrawing in the token deposited (for Lido, ETH instead of wstETH). Also deferred: per-user donation totals, ownership handover, an automatic payout job.

## Brand Commitments

- **Name:** "Commonwell" is a working name and may change. Keep it in few places, and build nothing that depends on it. Vaults created before the rename keep their on-chain names ("… · Yield Forward wstETH", symbol `yfWSTETH`); new vaults are named "… · Commonwell wstETH", symbol `cwWSTETH`.
- **Independent product.** Octant and Lido are credited as the technology underneath (in copy, Technical details and source links), never as a brand, partner or endorsement.
- **Existing assets:** the logo `public/icon.svg` (a leaf basin whose spray arcs over and falls as a drop into the ochre community circle, on a bottle-green tile), with `public/apple-touch-icon.png` and `public/favicon.ico` rendered from it.
- **Stated goal:** a clean, calm, trustworthy app that holds up when real funds are at stake.
- **Copy rules (ARCHITECTURE §6, binding):**
  - Values lead.
  - Never say "guaranteed" or "verified identity".
  - An unreviewed community gets one line under its name: "Check who runs it before depositing".
  - Only http(s) profile links are rendered.
- **Voice in use:** plain, short sentences in the second person. Say what happens and what doesn't ("A failed deposit changes nothing"), and state limits honestly ("The owner can't touch your deposit").
- **Mainnet stance: production, sober.**
  - Drop the "proof of concept" framing on mainnet, and state the risks factually in the FAQ.
  - The framing assumes the planned security review is done before launch. The app never claims a review or audit that hasn't happened.
  - The testnet site keeps its test-money wording.

## Evidence on Hand

- **First community:** Commons Hub Brussels, on the Lido type. Its name, description, website and image come from its EAS record, not the repo. Communities A and B are testnet seed data only.
- **Verifiable facts:**
  - the pinned Octant source (`06ae2b9`);
  - the fork tests in `contracts/test`;
  - per-chain addresses in `deployments/`;
  - each community's Technical details (contracts, roles, EAS records).
- **Live figures:** total deposited, generated (paid out plus waiting), what is waiting to be paid out, payout history and APR, all read from the chain or the vault type's APR source.
- **Absent, so never fabricate:**
  - testimonials and user or depositor counts;
  - TVL or funding claims beyond what the chain shows;
  - an audit report or badge;
  - partner logos or endorsements;
  - press;
  - a mainnet deployment.

## Product Principles

1. **Your deposit stays yours, visibly.** At every step, show what you keep, what the community receives, and how to withdraw. The way out is always reachable, even for retired or unlisted vaults.
2. **Checkable facts over reassurance.** Trust comes from facts a user can verify (addresses, roles, records, the automatic check), stated plainly. Never from words like "safe" or "guaranteed".
3. **Plain first, proof one step away.** A first-timer gets the plain answer. The crypto-native user finds the technical proof a click away, in the FAQ and Technical details, without crowding the page.
4. **No chain or asset is the default.** Units, wording and paths come from the deployment and the vault type. A screen that only works for Lido/ETH is unfinished.
5. **Exact where money is concerned.** Amounts stay exact, and rounding is only for display, with the exact value a hover away. USD appears only as a labelled approximation for totals across assets.
