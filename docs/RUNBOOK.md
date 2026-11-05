# Runbook

Operations for a deployment on any chain. Addresses come from `deployments/<name>.json` and the community page's **Technical details**. The vault steps below are for the Lido type (`lido-wsteth-v1`), the only vault type so far.

```sh
export DEPLOYMENT=hoodi   # deployments/<name>.json: hoodi-dev, hoodi, mainnet, …
export RPC=$(jq -r '.rpcUrls[0]' deployments/$DEPLOYMENT.json)
export VAULT=0x...        # Technical details → Vault
export FORWARDER=0x...    # Technical details → Payout forwarder
export TRIGGER=0x...      # Technical details → Payout trigger
```

**Signing `cast` calls.** The examples use `$SIGNER`:
- On a testnet, use `--private-key $KEY`. For the seeded communities, the admin keys are `ADMIN_A_KEY` and `ADMIN_B_KEY` in `.env.local`; for communities created in the app, use the owner's own wallet.
- On mainnet, never use a key from `.env.local`. Use a Foundry keystore (`--account <name>`) or a hardware wallet (`--ledger`). When the role is held by a Safe, propose the same call from the Safe instead.

## Deployments

| Command | What it does |
|---|---|
| `bun run deploy:core --deployment <name> [--chain hoodi\|mainnet\|<id>] [--kinds a,b]` | Deploys or reuses the shared contracts of every vault type the chain supports (including a new `DepositRouter` after the router changes) and EAS, then writes `deployments/<name>.json`. A new deployment takes its chain from `--chain` (default `hoodi`); an existing one keeps the chain in its file. |
| `bun run deploy:core --deployment <name> --fresh` | Deploys a new EAS, which empties the directory. Use it to reset a messy dev deployment. Never use it on a deployment people use: their communities and deposits would vanish from the app. The funds stay safe on-chain and can be withdrawn with `cast`. |
| `bun run seed --deployment <name>` | Creates and reviews Community A and B and deposits into each. Safe to re-run. Testnets only. |
| `bun run payout --deployment <name>` | Sends every pending payout in one transaction. Signs with `PAYOUT_KEY`, or `DEPLOYER_KEY` if that isn't set. |

**Off testnets** (mainnet):
- `deploy:core` needs `--live`.
- The scripts sign only with Foundry keystores: `DEPLOYER_KEYSTORE` and `PAYOUT_KEYSTORE`, created with `cast wallet import <name> --interactive`.
- The seed curator isn't added, so set `CURATOR_ADDRESSES`.
- The deployer controls nothing once the contracts exist. Fund it with just the gas and empty it afterwards.

```sh
DEPLOYER_KEYSTORE=yf-deployer CURATOR_ADDRESSES=0x… \
  bun run deploy:core --deployment mainnet --chain mainnet --live
```

## Payouts

Anyone can send a payout, in the app or with `bun run payout`. Payouts only exist after Lido's daily rate update; before that, there's nothing to send (the app's "Send all pending payouts" says "Nothing to send yet").

To send one vault's payout with `cast`:

```sh
cast send $TRIGGER "sendPayout(address,address)" $FORWARDER $VAULT --rpc-url $RPC $SIGNER
```

**Payouts paused after a Lido rate dip (`"!loss"`).** Octant's health check blocks reports when the rate drops. Payouts resume by themselves when the rate recovers. To report the dip immediately, the admin turns the check off; it switches back on after one report:

```sh
cast send $VAULT "setDoHealthCheck(bool)" false --rpc-url $RPC $ADMIN_SIGNER
cast send $TRIGGER "sendPayout(address,address)" $FORWARDER $VAULT --rpc-url $RPC $SIGNER
```

**Shares or reward tokens stuck at the forwarder.** These only reach the treasury, and anyone can trigger this:

```sh
cast send $TRIGGER "forwardToken(address,address)" $FORWARDER $TOKEN --rpc-url $RPC $SIGNER
```

## Deposits closed

| Situation | What to do |
|---|---|
| Everyone has withdrawn | Octant blocks deposits while a vault holds wstETH but no shares. The next deposit reopens it automatically: `DepositRouter` sends two payouts in the deposit transaction. To reopen without depositing, send two `sendPayout` calls in one Multicall3 transaction. |
| After a Lido rate dip | Deposits pause while the vault is worth less than its deposits, and reopen when the rate recovers. |
| Shut down | Permanent. Withdrawals and payouts still work. |

To shut a vault down for good (admin or emergency admin):

```sh
cast send $VAULT "shutdownStrategy()" --rpc-url $RPC $ADMIN_SIGNER
```

## Changing a community's treasury

A forwarder's treasury is fixed. The supported way to change it is to create a new vault:

1. Create a new vault for the new treasury, through the app's Create page or the seed code.
2. Retire the old vault link: revoke its EAS record, as below. Until it's revoked, the community page offers the old vault next to the new one.
3. Depositors withdraw from the old vault and deposit into the new one. Old positions stay withdrawable under My deposits.

The contract-level migration works, and it's covered by `contracts/test/Migration.t.sol`:

1. Call `setDragonRouter(newForwarder)` and wait 14 days.
2. Anyone calls `finalizeDragonRouterChange()`.
3. Call `setKeeper(newForwarder)`.

The app doesn't relist a migrated vault, though. Its live roles no longer match the forwarder its link was created with, so it drops out of the directory. Its deposits stay withdrawable.

To retire a vault link (owner only; `$LINK_UID` is Technical details → Vault link record):

```sh
SCHEMA=$(jq -r .schemas.communityVault deployments/$DEPLOYMENT.json)
EAS=$(jq -r .eas deployments/$DEPLOYMENT.json)
cast send $EAS "revoke((bytes32,(bytes32,uint256)))" "($SCHEMA,($LINK_UID,0))" --rpc-url $RPC $OWNER_SIGNER
```

## Curators

The curator list is `curators` in `deployments/<name>.json`. To add or remove one, edit the list and rebuild and redeploy the site. Removing a curator voids every review they gave. Only the curator who gave a review can remove it (an EAS rule). On mainnet, curators should be Safes or hardware wallets.
