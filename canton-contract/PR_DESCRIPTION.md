## Summary

Follow-up remediation from a review of the prior H-1/M-1/M-2/L-1–L-3 fix
(commit `812373a`), plus a fix to the deployment tooling, which was
non-functional as committed. Test count: 118 → 126, 0 failures.

## Security fixes

- **`RejectToken`/`Merge` could bypass a freeze.** Both let a holder
  dispose of or consolidate an official holding with no issuer
  co-authorization and no compliance check — a blacklisted holder could
  use either to route around `BurnByUser`'s and `Transfer`'s checks.
  Both now require `controller owner, issuer` and check
  `globalPaused`/`blackListed`, identical to `BurnByUser`. Documented
  tradeoff in `SECURITY.md`: this closes the freeze-bypass, but means
  neither choice can be used anymore to unilaterally clear a
  *non-cooperating* self-issued spam token (the earlier M-2 scenario) —
  that residual still depends on the Ledger-API-permissioning/
  consumer-side filtering already documented there.
- **`AddBlackList`'s cascade used `fetchByKey` on sibling registries** —
  the emergency freeze would hard-fail if a sibling registry happened to
  be missing. Switched to `lookupByKey`; blacklisting now proceeds
  regardless, clearing whichever sibling registries exist.
- **`MintProposal` had no way to lift a proposal-level pause** except
  `CancelMint` (which discards it outright). Added `UnpauseMint`.
- **Forwarder relayer visibility, redesigned.** The relayer previously
  needed a standing `readAs` grant over the issuer's (and minter's)
  party to resolve `AdminState`/`MintRegistry`/`ForwarderRegistry` via
  `fetchByKey` — broader access than the relayer's role requires. Fixed
  with **Explicit Contract Disclosure**
  (`queryDisclosure`/`submitWithDisclosures`): `ForwardRequest` now
  carries the exact registry/tracker/proposal contract ids the minter
  and issuer supplied at (jointly-authorized) creation time; `Execute`
  does a plain `fetch` on each and asserts ownership equality
  (`admin.owner == to`, etc.) instead of a key lookup. The relayer's own
  submission needs zero `readAs` — it carries exactly five disclosure
  blobs (compliance, forwarder, and mint registries, the nonce tracker,
  and the proposal), which in production the issuer/minter's service
  transmits to the relayer out of band alongside the request. Verified
  this actually works — and that a naive "just switch to plain fetch"
  attempt does *not* (Daml's plain-`fetch` visibility rule is exactly as
  strict as `fetchByKey`'s) — by testing directly against a running
  sandbox before committing to the approach. Documented in `SECURITY.md`.

## Build fix

- `daml.yaml`: `scenario:` (a legacy/deprecated key) replaced with
  `init-script:`.

## Test suite

- `Tests/CNGNTests.daml` — added freeze-gating coverage for `Merge`/
  `RejectToken` (blacklisted holder, globally paused).
- `Tests/ForwarderTests.daml` — rewritten around the explicit-disclosure
  execution model: forged-registry rejection, wrong-minter-proposal
  rejection, nonce mismatch/reuse/sequencing, all via
  `queryDisclosure`/`submitWithDisclosures` against the new
  `ForwardRequest` shape.
- `PolicyEnforcement.daml` — removed the forwarder tests now fully
  superseded by `ForwarderTests.daml`; fixed `Merge`/`RejectToken` tests
  for the new issuer-co-authorization requirement.

**126 tests, 0 failures** (`daml test` / `make test`), up from 118.

## Deployment tooling

The Makefile's "real Canton node" path was non-functional as committed:
`config/canton.local.conf` and `scripts/allocate-parties.sh` were empty
placeholders, no `canton` binary was available, and `start-bg`'s PID
capture was broken (`$!` read in a separate shell from the backgrounded
process, so `stop` could never have killed the right thing).

- `start`/`start-bg` now use `daml sandbox` — the Daml SDK's bundled
  ledger, a real single-node Canton participant, not a mock. Falls back
  to a real `-c <canton.conf>` automatically if one is ever populated
  for `ENV=staging|prod`; `config/canton.{staging,prod}.conf` are left
  as placeholders since filling them in requires real infrastructure
  this repo doesn't have.
- Fixed the PID-capture bug so `stop` genuinely works.
- Added `daml/Demo.daml` — seven self-contained, real Daml Scripts
  (`mintFlow`, `transferFlow`, `burnFlow`, `pauseTokenFlow`,
  `allowanceFlow`, `adminFlow`, `forwarderFlow`, plus `allFlows`),
  wired to new Makefile targets: `demo-mint`, `demo-transfer`,
  `demo-burn`, `demo-token-pause`, `demo-allowance`, `demo-admin`,
  `demo-forwarder`, `demo-all`. `adminFlow` covers add-minter, set-mint-
  amount, blacklist/whitelist, add/remove-trusted-contract, and global
  pause; `forwarderFlow` demonstrates the relayer submitting/paying for
  a mint the minter signed via explicit disclosure.
- Replaced the dead `allocate-parties` target with `list-parties` (real
  `daml ledger list-parties`).
- Deleted `scripts/deploy.sh` and `scripts/allocate-parties.sh` — dead,
  unreferenced, and one was actively misleading.

Every target was run live against a real sandbox, not just read: `make
deploy` → each `demo-*` target individually → `demo-all` → `list-parties`
→ `stop` (confirmed the ledger process actually exits).

## Known residual / out of scope

- `MintRegistry`/`ForwarderRegistry` are still one shared contract per
  issuer, so concurrent mints for *different* minters contend on the
  same contract (throughput characteristic, not a security bug — see
  code comments in `Admin.daml`).
- `RejectToken`/`Merge` no longer help a victim dispose of a
  non-cooperating self-issued spam token (see above); that residual is
  unchanged from the earlier M-2 fix's own documented scope.
- Full per-subject disclosure narrowing (a minter learning only *their
  own* grant, not the full `canMint`/`mintGrants` list) would need a
  further step (Daml interface views); not done here.

## Testing

```
cd canton-contract
make test          # daml test — 126 tests, 0 failures
make deploy        # build + start sandbox + upload + Setup:initialize
make demo-all      # exercise mint/transfer/burn/pause/allowance/admin/forwarder
make stop
```
