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
