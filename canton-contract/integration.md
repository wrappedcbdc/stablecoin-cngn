# cNGN Canton Integration

## Development API Setup and Verification

### 1. Overview

The cNGN Daml contracts are deployed to a Canton development sandbox. A Daml JSON API is running on the VM to allow applications such as Node.js and TypeScript clients to interact with the ledger over HTTP.

The immediate objective is to expose the contract functionality through a developer-friendly interface, including querying contracts, creating proposals, minting tokens, transferring tokens, burning tokens, managing allowances, and executing authorized forwarding requests.

### 2. Development environment

| Item              | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Daml SDK          | `2.10.4`                                                           |
| Package name      | `cngn`                                                             |
| Package version   | `1.0.0`                                                            |
| DAR file          | `.daml/dist/cngn-1.0.0.dar`                                        |
| Package ID        | `e576e21e686d8f1170ef90c8f24ce53712e5678723166a8fb8c19c0462c9a1bd` |
| Canton Ledger API | `localhost:6865` on the VM                                         |
| JSON API          | `http://102.209.46.187:7575`                                       |
| Query endpoint    | `/v1/query`                                                        |

The package ID identifies the compiled Daml package. It is not a contract address equivalent to an EVM address.

### 3. JSON API startup

The JSON API was started on the VM using:

```bash
nohup daml json-api \
  --ledger-host localhost \
  --ledger-port 6865 \
  --address 0.0.0.0 \
  --http-port 7575 \
  > ~/json-api.log 2>&1 &
```

The service was confirmed to be listening on port `7575`.

### 4. Querying a template

The JSON API expects template identifiers in this format:

```text
<packageId>:<moduleName>:<entityName>
```

For the cNGN token template:

```text
e576e21e686d8f1170ef90c8f24ce53712e5678723166a8fb8c19c0462c9a1bd:CNGN:CNGNToken
```

Example request:

```bash
curl --connect-timeout 5 -i \
  http://102.209.46.187:7575/v1/query \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "templateIds": [
      "e576e21e686d8f1170ef90c8f24ce53712e5678723166a8fb8c19c0462c9a1bd:CNGN:CNGNToken"
    ]
  }'
```

Replace `YOUR_TOKEN` with a valid development access token. Do not commit tokens or signing secrets to source control.

### 5. Verification result

The query returned:

```json
{
  "result": [],
  "status": 200
}
```

**Interpretation:** The endpoint accepted the request and returned a successful query response. No active contracts matching the `CNGNToken` template were returned for this query.

This is expected from the current setup script: it creates administrative and authorization registries, along with a nonce tracker, but does not create any cNGN token holdings.

This confirms the HTTP query path works. It does not yet verify token minting, transfers, or other contract choices.

### 6. Development party identities

The setup script creates these demo parties:

* **Owner:** administrative control and registry ownership.
* **Minter:** mint authorization and mint proposal execution.
* **Relayer:** authorized forwarding role.

These are development identities, not production credentials. The actual party IDs must be supplied to the application configuration.

### 7. Security considerations

The current JSON API is exposed on a public IP using plain HTTP. This is acceptable only for controlled development testing.

Before using real assets or production identities:

* Restrict port `7575` with firewall rules or a private network.
* Configure HTTPS/TLS and an appropriate authentication and authorization mechanism.
* Validate token signatures and claims against the configured identity provider.
* Never expose unrestricted ledger access to the public internet.
* Keep issuer, owner, minter, and relayer credentials separate and apply least privilege.

The development JWT used during testing was generated with a temporary secret that was not retained. Do not rely on that token for future integration; configure a proper, repeatable development authentication setup.

### 8. Next integration steps

1. Query the active `AdminState`, `MintRegistry`, `ForwarderRegistry`, `TrustedContractRegistry`, and `NonceTracker` contracts.
2. Verify the exact template IDs and retrieve active contract IDs or keyed contracts.
3. Create and execute a `MintProposal` using the required party authorizations and matching mint grant.
4. Query the resulting `CNGNToken` holding.
5. Implement and test transfer, burn, pause/unpause, merge, allowance, and forwarding operations.
6. Build a Node.js/TypeScript client with reusable authentication, query, create, and exercise helpers.

**Important:** Canton uses parties, templates, package IDs, and active contract IDs rather than a single EVM-style contract address. Contract IDs may change when consuming choices archive and recreate contracts, so the client must refresh its ledger state instead of treating old IDs as permanent.

---

### 9. TypeScript SDK and CLI Interface

The TypeScript SDK is implemented in `canton-contract/` and exposes both programmatic APIs and executable CLI commands:

#### Architecture
* [`src/client.ts`](file:///Users/ayoseun/Documents/GitHub/Convexity/stablecoin-cngn/canton-contract/src/client.ts): Core `CantonClient` handling authentication, `/v1/query`, `/v1/fetch`, `/v1/create`, `/v1/exercise`, and `/v1/exerciseByKey` with Canton-specific error parsing.
* [`src/types.ts`](file:///Users/ayoseun/Documents/GitHub/Convexity/stablecoin-cngn/canton-contract/src/types.ts): Strongly typed Daml contract payloads (`CNGNTokenPayload`, `MintProposalPayload`, `AllowancePayload`, `AdminStatePayload`, etc.).
* [`src/cngn-service.ts`](file:///Users/ayoseun/Documents/GitHub/Convexity/stablecoin-cngn/canton-contract/src/cngn-service.ts): High-level `CNGNService` encapsulating the full business lifecycle:
  - **Token Holdings:** `getTokens()`, `getBalance()`, `transfer()`, `burn()`, `pauseToken()`, `unpauseToken()`, `mergeHoldings()`, `rejectToken()`.
  - **Minting Lifecycle:** `createMintProposal()`, `executeMint()`, `cancelMint()`, `unpauseMint()`, `rejectMint()`.
  - **Allowances:** `createAllowance()`, `spendAllowance()`, `increaseAllowance()`, `decreaseAllowance()`, `revokeAllowance()`.
  - **Compliance & Admin:** `getAdminState()`, `pauseAll()`, `unpauseAll()`, `addBlacklist()`, `removeBlacklist()`.
  - **Mint Registry & Meta-transactions:** `getMintRegistry()`, `grantMint()`, `removeCanMint()`, `getNonce()`, `executeForward()`.
* [`cngn.ts`](file:///Users/ayoseun/Documents/GitHub/Convexity/stablecoin-cngn/canton-contract/cngn.ts): Root library export and `createCNGNService()` factory helper.

#### CLI Commands

```bash
# Query all active contracts & balances
npm run query

# Create a mint proposal
npm run mint:propose

# Execute an active mint proposal
npm run mint:execute

# Transfer tokens (contractId, toParty, amount)
npm run transfer -- <contractId> <toParty> <amount>

# Burn tokens (contractId, amount)
npm run burn -- <contractId> <amount>

# Manage allowances
npm run allowance
npm run allowance -- create <ownerParty> <spenderParty> <amount>

# Admin global pause / blacklist
npm run admin -- status
npm run admin -- pause
npm run admin -- unpause
npm run admin -- blacklist-add <party>
npm run admin -- blacklist-remove <party>

# Consolidate fragmented holdings (UTXO merge)
npm run merge
```
