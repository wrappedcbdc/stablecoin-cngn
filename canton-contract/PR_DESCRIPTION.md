## Summary

Remediates the full set of Canton/DAML audit findings (H-1, M-1, M-2, L-1
through L-3, plus a second bundled review pass) for the cNGN contracts,
and adds a proper per-module + per-flow test suite. Net: 118 passing
tests, 0 failures, choice coverage up from 50% to 82.6%.

## Security fixes

- **[H-1] Caller-controlled `AdminState` bypassed blacklist and mint
  revocation.** `Transfer`, `BurnByUser`, and `ExecuteMint` took a
  caller-supplied `adminCid` and never verified it belonged to the
  issuer — any party could forge their own permissive registry to defeat
  a freeze or a revoked mint grant. `AdminState` now has a `key
  owner`/`maintainer key`; every consumer resolves it via `fetchByKey`,
  and the token/mint choices require joint `owner, issuer` /
  `minter, issuer` authorization so the fetch is both authorized and
  visible.
- **[M-1] Legitimate transfers/mints were blocked by registry
  visibility.** Resolved as a side effect of the H-1 fix — the issuer is
  now a mandatory co-authorizer on every value-moving choice, so the
  registry (of which the issuer is the sole signatory) is always
  visible when it's needed.
- **[M-2] Zero/negative-value spam holdings.** Added `ensure amount > 0`
  to `CNGNToken`, `MintProposal`, and `Allowance` — closes the
  unremovable zero-value-holding griefing vector. Residual (documented
  in `SECURITY.md`): a positive-value self-issued token from an
  untrusted party still requires Ledger API command permissioning or
  consumer-side issuer-allowlisting outside this package.
- **[L-1] Pause was per-holding, not atomic.** Added `globalPaused` to
  the compliance registry with `PauseAll`/`UnpauseAll`, checked in
  `Transfer`, `BurnByUser`, and `ExecuteMint`.
- **[L-2] `BurnByUser` ignored blacklist and pause entirely** (it took an
  `adminCid` parameter and never fetched it). Now fetches the compliance
  registry and checks both.
- **[L-3] Mint grants were scoped to `(minter, amount)`, not to a
  specific proposal** — a stale same-amount proposal could consume a
  grant meant for a different one. Grants are now bound to an
  issuer-chosen `proposalId`, and `MintProposal` has a
  `key (issuer, proposalId)` so ids can't collide.
- **Registry confidentiality split.** The original `AdminState` bundled
  blacklist, mint authorization, forwarder allowlist, and trusted
  contracts in one contract, so a plain `Transfer` disclosed the entire
  thing to the holder. Split into `AdminState` (blacklist + pause),
  `MintRegistry`, `ForwarderRegistry`, `TrustedContractRegistry`, each
  independently keyed — a transfer now only ever touches the compliance
  registry.
- **`Forwarder.Execute` checked the wrong party against the forwarder
  allowlist** (`from`/minter instead of `relayer`) — under the shipped
  config every forward would have failed, and "fixing" it the obvious
  way would have skipped relayer authorization entirely. Corrected, plus
  added the missing minter-blacklist check.
- **Blacklist didn't cascade.** `AddBlackList` now strips the target from
  `canMint`, `mintGrants`, `canForward`, and `trustedContracts` in the
  same transaction; `AddCanMint`/`AddCanForward`/`AddTrustedContract` all
  reject an already-blacklisted party up front.
- **Replay protection wired up for real.** `NonceTracker` is now keyed to
  the minter (not the relayer), and `Execute` asserts the request's
  `nonce` matches the tracker and advances it atomically.
- **`Allowance.SpendAllowance` aborted on exact exhaustion** instead of
  archiving cleanly (`error` call left a spender unable to ever spend
  their full remaining allowance). Now returns
  `Optional (ContractId Allowance)`; all `Allowance` choices reject
  non-positive arguments.

## New functionality

- **`CNGNToken.Merge`** — consolidates matching holdings (same issuer,
  owner, pause state), countering the fragmentation `Transfer`'s
  change-creation causes over time.
- **`RejectToken` / `RejectMint` / `RejectAllowance` / `RejectForward`**
  — give every non-consenting observer (holder, minter, spender,
  relayer) an unconditional way to dispose of a contract they never
  solicited.

## Build fixes (unrelated to the audit, found while getting things to compile)

- `Setup.daml` imported a nonexistent `MinimalForwarder` module; fixed to
  `Forwarder`.
- `daml.yaml` was missing the `daml-script` dependency.
- `CNGN.daml` used `when` without importing `DA.Action`.

## Test suite

Reorganized/expanded under `daml/Tests/`:

- `Common.daml` — shared `setupParties`/`createRegistries` helpers.
- `AdminTests.daml` (25 tests) — every `AdminState`/`MintRegistry`/
  `ForwarderRegistry`/`TrustedContractRegistry` choice in isolation.
- `CNGNTests.daml` (36 tests) — `CNGNToken`, `MintProposal`, `Allowance`.
- `ForwarderTests.daml` (11 tests) — `ForwardRequest`, `NonceTracker`.
- `UserFlowTests.daml` — three end-to-end flows: user (hold → transfer →
  burn), admin (every registry capability exercised in one run), and
  cngn (mint → approve → burn).
- `PolicyEnforcement.daml` (unchanged in structure, extended) — the
  cross-cutting security-regression suite for the H-1/M-1/M-2/L-1–L-3
  attack scenarios and their fixes.

**118 tests, 0 failures.** Choice coverage: 38/46 (82.6%), up from 23/46
(50%) at the start of this pass — remaining gaps are exclusively the
implicit `Archive` choice every template gets.

## Known residual / out of scope

- `MintRegistry`/`ForwarderRegistry` are still one shared contract per
  issuer, so concurrent mints for *different* minters contend on the
  same contract (throughput characteristic, not a security bug — see
  code comments in `Admin.daml`).
- `TrustedContractRegistry` remains a documented no-op placeholder —
  nothing in the package reads it to gate anything; kept rather than
  removed pending a decision on whether it's needed.
- `Allowance` is a standalone approve/spend ledger; there's no
  `TransferFrom` that debits a `CNGNToken` against it yet.
- Full per-subject disclosure narrowing (a minter learning only *their
  own* grant, not the full `canMint`/`mintGrants` list) would need a
  further step (Daml interface views); not done here.

## Testing

```
cd canton-contract
make test
```
