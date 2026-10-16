# cNGN on Sui — port plan

## Business use case (from the EVM contracts)

cNGN is a permissioned, custodian-issued Naira-pegged stablecoin, split
across three cooperating EVM contracts:

- **`cngn.sol`** — upgradeable ERC-20, 6 decimals, fixed name/symbol
  "cNGN". `transfer`/`transferFrom` block if either party is blacklisted.
  `mint(amount, to)` requires a live, single-use admin grant: caller must
  have `canMint == true` *and* `amount` must exactly equal an admin-set
  `mintAmount` cap; the grant is consumed (`RemoveCanMint`) right after a
  successful mint. `burnByUser` is self-burn only. Pausable
  (`whenNotPaused` gates transfers only, not mint/burn).
- **`Operations.sol` (Admin)** — the access-control registry:
  `canMint`, `mintAmount[user]`, `canForward`, `trustedContract`,
  `isBlackListed`, all owner-gated (or owner-or-trusted-contract for the
  mint grant functions).
- **`forwarder.sol`** — EIP-2770 meta-tx relayer: verifies an EIP-712
  signature from the minter, checks `canForward`/`canMint` via Admin,
  then forwards the call so the minter can mint gas-free.

Core invariants to preserve: blacklist gating on every transfer,
single-use exact-amount mint grants, contract-wide pause, owner-controlled
registries, gasless minting for the minter.

## Design decisions (confirmed with user)

1. **Coin model** — use `sui::coin`'s regulated-currency framework
   (`TreasuryCap` + `DenyCapV2` via `create_regulated_currency_v2`)
   instead of a hand-rolled balance table. Reason: on Sui, `Coin<T>`
   objects move peer-to-peer without going through module code, so an
   EVM-style blacklist check *inside* a `transfer()` function would never
   actually run — transfers don't call our module. The only way to
   enforce a blacklist/pause on every transfer of a coin type is Sui's
   native deny-list mechanism, enforced by validators themselves. This is
   also what USDC-on-Sui uses for the same reason.
2. **Forwarder** — dropped entirely. Sui has native sponsored
   transactions (gas station pattern) for gasless UX, so there's no need
   to port `forwarder.sol`'s EIP-712 signature verification on-chain.
3. **Admin state** — single shared `AdminRegistry` object (mirrors
   `Operations.sol` as one contract), gated by an `AdminCap` capability
   object instead of `onlyOwner`.

## Module layout

```
sui-contract/
  Move.toml
  sources/
    admin.move   — AdminCap, AdminRegistry{can_mint, mint_amount}
    cngn.move     — CNGN witness, CoinState{treasury, deny_cap}, mint/burn/pause/blacklist entrypoints
  tests/          — (not yet written)
```

`admin.move` intentionally does **not** hold a `black_listed` table or
`can_forward`/`trustedContract` — blacklisting is delegated entirely to
the framework `DenyList` (queried via
`coin::deny_list_v2_contains_current`) so there's a single source of
truth instead of two blacklist stores that could drift. `canForward`/
`trustedContract` have no Sui equivalent now that the forwarder is gone.

## EVM → Sui mapping

| EVM | Sui | Notes |
|---|---|---|
| `Operations.canMint` / `mintAmount` | `admin::AdminRegistry.can_mint` / `.mint_amount` (`Table<address, _>`) | same semantics |
| `Operations.AddCanMint`/`RemoveCanMint` | `admin::add_can_mint` (AdminCap-gated) / `admin::remove_can_mint` (`public(package)`, called internally by `cngn::mint`) | EVM's `onlyOwnerOrTrustedContract` collapses to a package-private call since the only real caller was the token contract itself |
| `Operations.isBlackListed` / `AddBlackList` / `RemoveBlackList` | `sui::deny_list::DenyList` + `coin::deny_list_v2_contains_current` / `_add` / `_remove` | validator-enforced, not app-level |
| `cngn.pause()` / `unPause()` | `coin::deny_list_v2_enable_global_pause` / `_disable_global_pause` (needs `allow_global_pause: true` at currency creation) | |
| `cngn.mint()` | `cngn::mint` | same blacklist + single-use exact-amount grant checks, using `DenyList` for the blacklist check |
| `cngn.burnByUser()` | `cngn::burn_by_user` | **intentional deviation**: permissionless self-burn. Owning the `Coin<CNGN>` object *is* the authorization; the EVM `onlyDeployerOrForwarder` modifier is over-restrictive relative to the stated "user burns their own tokens" intent and has no clean Sui analogue anyway |
| `forwarder.sol` | *(none)* | superseded by Sui's native sponsored-transaction gas station |
| `Ownable` (single owner) | `AdminCap` capability object | same one-key control surface, capability-based instead of address-based |

## Status

- `admin.move` and `cngn.move` are written (not yet build-verified — no
  `sui` CLI available in this environment).
- Framework function names used (`create_regulated_currency_v2`,
  `deny_list_v2_add/_remove/_enable_global_pause/_disable_global_pause/_contains_current`,
  `mint_and_transfer`, `burn`, `total_supply`) are from memory of the Sui
  `sui::coin` module and need to be checked against the actual framework
  source (pinned via `Move.toml`'s `rev = "framework/testnet"`) before
  building — parameter order/names may have shifted between Sui
  releases.

## Next steps

1. Run `sui move build` once the `sui` CLI is available; fix any API
   drift against the pinned framework revision.
2. Write `tests/cngn_tests.move` covering: mint grant lifecycle
   (grant → mint exact amount → grant consumed → re-mint fails without a
   fresh grant), amount-mismatch rejection, blacklist blocking mint,
   pause blocking a plain `Coin` transfer, burn-by-non-owner failing
   (can't happen by construction — worth a comment/test noting why).
3. Decide on `AdminCap` custody for production: single EOA vs. a
   Sui multisig address vs. wrapping it behind a timelock/policy object.
