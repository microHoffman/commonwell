# Commonwell

Deposit into a community's vault, keep your position, and let its yield fund the community. The first vault type is Lido's: deposit ETH or wstETH, and the staking rewards go to the community. The first community, Commons Hub Brussels, uses it.

It runs on the Hoodi testnet today. Ethereum mainnet is next, as the first deployment with real users and funds; see [Mainnet](#mainnet). The design isn't tied to one chain or asset: each chain can offer different vault types, each type can take a different asset, and a community can have vaults on several chains.

It uses:
- **Octant v1.3.0 vaults, unmodified:** for the Lido type, a yield-skimming `LidoStrategy` with its own `YieldForwarder`;
- **EAS** for community profiles, vault links and reviews;
- **a static Nuxt site** with social-login wallets.

Design and decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Operations: [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Layout

| Path | Contents |
|---|---|
| `contracts/` | Foundry: pinned Octant, the `PayoutTrigger` and `DepositRouter` contracts, Hoodi fork tests |
| `packages/core/` | Shared TypeScript (viem): EAS records, discovery, vault types (`src/kinds`), vault checks, deposits, payouts, community creation |
| `scripts/` | CLIs: `keys`, `deploy:core`, `seed`, `payout`, for any chain in `scripts/networks.ts` |
| `apps/web/` | The Nuxt site |
| `deployments/` | One file per deployment, each on one chain: `hoodi-dev` for development, `hoodi` for the shared demo, and a mainnet file once mainnet is deployed |

## Setup

Needs Bun 1.3+, Foundry v1.7.1 (`foundryup --install v1.7.1`; CI uses the same) and git.

```sh
git submodule update --init   # not --recursive: that layout reproduces the committed contract artifacts
bun install
bun run contracts:test   # Hoodi fork tests (uses an archive RPC, by default ethpandaops)
bun run test             # core unit tests (bare `bun test` would also pick up the submodules' tests)
bun run contracts:check  # the committed ABIs and bytecode match a fresh build
```

## Run it on Hoodi

1. **Keys.** `bun run keys` writes testnet-only keys to `.env.local` and prints their addresses.
   - Fund the deployer with Hoodi ETH from <https://hoodi-faucet.pk910.de> or <https://faucet.hoodi.ethpandaops.io>. About 0.15 ETH covers one deployment: about 0.02 for `deploy:core`, and for the seed 2 × `SEED_AMOUNT` (default 0.01 ETH) in deposits plus about 0.07 in gas money for the seed accounts.
   - Add `CURATOR_ADDRESSES=<your wallet>` to `.env.local`, so you can review communities in the app.
2. **Contracts and demo data.**
   ```sh
   bun run deploy:core --deployment hoodi-dev
   bun run seed --deployment hoodi-dev
   ```
3. **Wallet sign-in.**
   - At developer.metamask.io, create an Embedded Wallets (Web3Auth) project on Sapphire Devnet.
   - Allowlist `http://localhost:3000` and your Pages domain.
   - Copy `apps/web/.env.example` to `apps/web/.env` and set the client ID.
4. **Develop.** `bun run web:dev`, then open <http://localhost:3000>.

### The shared demo

```sh
bun run deploy:core --deployment hoodi
bun run seed --deployment hoodi
git add deployments/hoodi.json && git commit -m "Update the hoodi deployment" && git push
```

The site is hosted on Cloudflare Pages (project `commonwell`), which is connected to this GitHub repo: every push to `main` builds the site (`apps/web/.output/public`) and publishes it. There is no manual upload. `main` is protected: changes land through pull requests once CI (`.github/workflows/ci.yml`) passes. The build takes its settings from the project's environment variables, the same names as in `apps/web/.env.example`: `NUXT_PUBLIC_DEPLOYMENTS=hoodi` for the shared demo, `NUXT_PUBLIC_WEB3_AUTH_CLIENT_ID`, and optionally `NUXT_PUBLIC_RPC_URLS`.

Payouts appear after the next Lido report (daily). Send them with "Pay out" in the Payouts box on a community page, "Send all pending payouts" in the account menu (curators), or `bun run payout --deployment hoodi`.

## How it works

- **Vaults.** Each community has its own vault on each chain it uses, of one of the chain's vault types. Today every vault is the Lido type: an Octant `LidoStrategy` holding wstETH. Deposits are valued in stETH, so as Lido's rate rises, the extra value is minted to the community's `YieldForwarder`. That forwarder pays wstETH to the community treasury.
- **Deposits.** `DepositRouter` makes each deposit one transaction: it stakes ETH through wstETH, or takes wstETH with a permit signature or an approval, then deposits for the user. Wallets with EIP-5792 batching do approve and deposit for wstETH in one confirmation.
- **Withdrawals.** Depositors withdraw the same staked value they put in, as fewer wstETH.
- **Payouts.** Each forwarder's keeper is `PayoutTrigger`, a tiny public contract. Anyone can send payouts, and they always go to the treasury.
- **Communities.** They're EAS records: a profile, a link to each vault, and a curator review that gives the "Reviewed" label and a short URL.
- **The automatic check.** The app verifies every vault by recomputing its CREATE2 address from the link's settings and the frozen contract code, then reading its live roles. Vaults that fail the check aren't listed, but their deposits stay withdrawable under My deposits.
- **APR.** The vault donates exactly what Lido's rate adds, so its yield is Lido's staking APR. The app shows Lido's 7-day average from Lido's API (`eth-api.lido.fi`, and `eth-api-hoodi.testnet.fi` on Hoodi).

## Contracts

Every Lido-type vault is a pair of unmodified [Octant v2 core](https://github.com/golemfoundation/octant-v2-core/tree/06ae2b9fa2e4443a3d9f6148498d4ada4f9861e8) contracts (v1.3.0, `06ae2b9`), plus contracts that all communities on a chain share. Addresses per chain are in [`deployments/`](deployments), and a community page lists its own under **Technical details**.

| Contract | One per | What it does |
|---|---|---|
| `LidoStrategy` (Octant) | vault | The vault. Holds the deposits as wstETH, values them in stETH and mints the increase to the forwarder. Its management is the community owner. |
| `YieldForwarder` (Octant) | vault | The vault's keeper and donation address. Redeems what it's minted and sends the wstETH to the community treasury, which is fixed when it's created. |
| `YieldSkimmingTokenizedStrategy` (Octant) | chain | The shared logic every vault delegates to. |
| [`PayoutTrigger`](contracts/src/PayoutTrigger.sol) | chain | Every forwarder's keeper. Anyone can call `sendPayout(forwarder, vault)`; it holds nothing and has no owner. |
| [`DepositRouter`](contracts/src/DepositRouter.sol) | chain | One-transaction deposits: stakes ETH into wstETH, or takes wstETH with a permit or approval, then deposits for the user. Not part of any vault's address, so it can be replaced. |
| wstETH (Lido) | chain | Lido's staked ETH, the asset every Lido-type vault holds. |
| EAS + SchemaRegistry | chain | Community profiles, vault links and reviews. Hoodi uses its own copies; chains with an official EAS use that. |

The shared contracts go through the CREATE2 deployer with the zero salt, so `PayoutTrigger` and the shared logic have the same address on every chain.

## Several chains

Each file in `deployments/` is one chain with its own EAS records and vaults. The site reads every deployment in `NUXT_PUBLIC_DEPLOYMENTS` (comma-separated; the first is the default chain) and shows a community once even when it has records on several chains. Records count as one community when a curator reviewed them with the same short name, or when the same owner registered them under the same name. Its page then offers every active vault, on each chain.

Optional per-deployment settings: `rpcUrls` (public RPCs; `NUXT_PUBLIC_RPC_URLS=<chainId>=<url>,<url>;…` overrides them in the browser) and `easExplorer` (e.g. `https://easscan.org`), which record links use instead of the transaction that created them.

The scripts work on any chain in [`scripts/networks.ts`](scripts/networks.ts) (Hoodi and Ethereum today). `deploy:core` takes the chain for a new deployment; the other scripts read it from the deployment file:

```sh
cast wallet import yf-deployer --interactive                       # once: your deployer, encrypted by Foundry
DEPLOYER_KEYSTORE=yf-deployer CURATOR_ADDRESSES=0x… \
  bun run deploy:core --deployment mainnet --chain mainnet --live  # asks for the keystore password
```

- **Mainnet safety.**
  - A chain that isn't a testnet needs `--live`.
  - There the scripts sign only with Foundry keystores (`DEPLOYER_KEYSTORE`, `PAYOUT_KEYSTORE`), never with a key in `.env.local`.
  - The seed curator isn't added there, and `seed` refuses to run.
  - The deployer controls nothing once the contracts exist, so fund it with just the gas and empty it afterwards.
- **EAS.** Where the chain has an official EAS (Ethereum does), `deploy:core` uses it and sets `easExplorer`.
- **Adding a chain.** Add it to `chains` in `packages/core/src/config.ts` and to `scripts/networks.ts`.
- **Adding a vault type.** Add its core module in `packages/core/src/kinds/` and its script module in `scripts/kinds/`. The script module says which chains the type supports, deploys its shared contracts, lists them for explorer verification, and makes the seed deposit. Typechecking fails until both exist. `deploy:core` deploys every type that supports the chain; `--kinds` picks some.

## Mainnet

The contracts, scripts and web app can all target Ethereum mainnet: `deploy:core --chain mainnet --live`, as in [Several chains](#several-chains). Nothing is deployed there yet. Before real funds go in:
- **Admin roles.** Community owners, emergency admins and curators should be Safes or hardware wallets. The scripts already refuse `.env.local` keys off testnets; the keys from `bun run keys` are testnet-only.
- **Wallet sign-in.** Mainnet needs a Sapphire Mainnet Web3Auth project and `NUXT_PUBLIC_WEB3_AUTH_NETWORK=sapphire_mainnet`.
- **Production work.** A security review, Safe admins and curators, a paid RPC and a hosted index.

What's still tied to Hoodi or Lido, and the full list, is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §9.
