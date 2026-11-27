# Deployment-layer controls

These are controls that cannot be enforced inside the DAML package itself and
must be enforced by whoever operates the participant node / issuer service.

## Canonical issuer enforcement for CNGNToken, MintProposal, Allowance

`signatory issuer` (or `tokenOwner`) on these templates means any party that
can submit commands against the vetted package can create its own instance,
naming itself as issuer and any other real party as the non-consenting
observer (`owner` / `spender` / `minter`). The `ensure amount > 0` invariant
on each template only rejects the zero/negative-value case; it does not stop
an attacker from self-issuing a positive-amount instance.

There is no way to pin "issuer" to one fixed, canonical party from inside a
DAML template — party values are runtime data, not part of the template
type. Closing this requires one of:

1. **Ledger API / participant command permissioning** — restrict which
   parties are allowed to submit `CNGNToken` (and `MintProposal`,
   `Allowance`) create commands to the official issuer's automation only.
   This is the authoritative fix: it prevents the forged contracts from
   ever being created.
2. **Consumer/wallet-side filtering** — any application reading the ledger
   (wallet UI, balance query, indexer) must filter query results to
   `issuer == <the known official party ID>` and disregard any instance
   with a different issuer. This does not remove forged contracts from a
   party's active contract set, but it prevents them from being mistaken
   for official cNGN.

Both controls should be applied; (1) is the primary defense, (2) is a
defense-in-depth backstop for any application that queries the ledger
directly.

## RejectToken / Merge are gated the same as Burn — residual for unsolicited tokens

`CNGNToken.RejectToken` and `CNGNToken.Merge` require `controller owner, issuer`
and check `globalPaused`/`blackListed` against the issuer's compliance
registry, identically to `BurnByUser`. This closes a gap where a frozen
holder could dispose of (or consolidate) an official holding outside
compliance control via a path that wasn't checked the same way transfer
and burn are.

The tradeoff: since both choices now require the *token's own issuer* to
co-authorize, they no longer give a victim a way to unilaterally clear a
self-issued, non-cooperating party's unsolicited token (the M-2 spam
scenario) — that issuer has no reason to co-sign a disposal of their own
spam. The zero/negative-value variant of that spam is still closed by
`ensure amount > 0`; a positive-value spam token from an untrusted
self-issuer is a residual that requires the Ledger API permissioning /
consumer filtering above, not an on-ledger `Reject` path.

## Forwarder relayer visibility — Explicit Contract Disclosure

`Forwarder.Execute` is designed so the relayer's own command submission
never needs a standing `readAs` grant over the issuer's or minter's
party. `ForwardRequest` carries the exact registry/tracker/proposal
contract ids the minter and issuer supplied at (jointly-authorized)
creation time, `Execute` does a plain `fetch` on each and asserts
ownership equality (`admin.owner == to`, etc.) rather than resolving them
by key — closing the identity-forgery gap `fetchByKey` closes for the
direct paths, without requiring the relayer to hold a key-lookup-capable
`readAs`.

Plain `fetch`, however, still requires the *submitting* party to already
have visibility of the contract (via being a stakeholder, or via
[Explicit Contract
Disclosure](https://docs.daml.com/app-dev/explicit-contract-disclosure.html)).
The relayer is neither, so the relayer's `Execute` submission must be
made with `submitWithDisclosures`/`submitMultiWithDisclosures` (Daml
Script), or the equivalent `disclosed_contracts` field on the Ledger
API, carrying the disclosure blobs for exactly: the compliance registry,
the forwarder registry, the mint registry, the minter's nonce tracker,
and the mint proposal. Those blobs are obtained via `queryDisclosure` (or
the Ledger API's `include_created_event_blob`) by whichever party can
already see each contract (issuer for the four registry/proposal
contracts, minter for their own nonce tracker) and must be transmitted
to the relayer out of band alongside the `ForwardRequest` — this is a
real integration requirement for whatever service submits `Execute` on
the relayer's behalf, not something the ledger distributes automatically.

If a policy change (blacklist, revocation, pause) happens after a
`ForwardRequest` is created but before it's executed, the referenced
registry contract is archived and replaced — the stale disclosure/cid no
longer resolves, and `Execute` fails outright rather than running against
outdated state. This means an in-flight forward request becomes
unexecutable after *any* change to the referenced registries (not just
ones targeting the minter or relayer), matching the same
availability-vs-correctness tradeoff already accepted for the blacklist
cascade below.
