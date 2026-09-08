# cNGN Protocol: Chain-Agnostic Token & Architecture Specification

## 1. Introduction & Protocol Overview

**cNGN** is a regulated, fiat-backed Nigerian Naira (NGN) stablecoin pegged 1:1 to the liquid fiat reserve. Operating under the Nigerian SEC Regulatory Incubation (RI) program, cNGN is designed to bridge traditional banking rails, institutional liquidity providers, fintechs, and decentralized financial ecosystems.

### Purpose of this Document
This specification defines the **universal architecture, data models, state invariants, permissions, and operational lifecycles of the cNGN stablecoin**. It is written to be **strictly chain-agnostic**. Any software engineer, smart contract architect, or protocol developer should be able to read this document and build a compliant, secure cNGN implementation on **any blockchain or distributed ledger system**.

---

## 2. Canonical Token Parameters

Regardless of the target blockchain architecture, every cNGN implementation must adhere to these foundational parameters:

| Parameter | Canonical Value | Description |
| :--- | :--- | :--- |
| **Token Name** | `cNGN` | Official token title |
| **Token Symbol** | `cNGN` | Ticker symbol (case-sensitive) |
| **Precision / Decimals** | `6` | 1 cNGN = $10^6$ base atomic units (`1 cNGN = 1,000,000 units`) |
| **Peg / Backing** | `1:1 NGN` | Backed 1:1 by liquid Nigerian Naira fiat / central bank reserves |
| **Issuance Model** | Permissioned Mint & Burn | Single-use exact-amount authorizations |
| **Compliance Layer** | Native or Programmatic Blacklisting | Prohibits sanctioned entities from transferring or holding |
| **Circuit Breakers** | Global Pause Mechanism | Halts secondary market transfers during emergencies |

---

## 3. Core Actors & Privilege Hierarchy

The cNGN protocol defines five distinct operational roles:

```
                      +------------------------------------------+
                      |         System Governance / Owner        |
                      |   (Multi-Signature Vault / Timelock)     |
                      +---------------------+--------------------+
                                            |
                 +--------------------------+--------------------------+
                 |                          |                          |
                 v                          v                          v
      +--------------------+      +--------------------+      +--------------------+
      | Authorized Minters |      | Compliance Admin   |      | Relayers / Gas     |
      | (Banks / Custody)  |      | (Blacklist Manager)|      | Station Sponsors   |
      +--------------------+      +--------------------+      +--------------------+
                 |                          |                          |
                 +--------------------------+--------------------------+
                                            |
                                            v
                               +------------------------+
                               | End Users & Holders    |
                               +------------------------+
```

1. **System Governance (Owner / MultiSig)**:
   - Has supreme administrative authority.
   - Authorizes and configures mint grants for minters.
   - Activates and deactivates global emergency pause.
   - Assigns role delegations and upgrades contract logic where upgradability is supported.

2. **Authorized Minters (Issuers / Custodians / Off-takers)**:
   - Entities authorized to mint new cNGN tokens against verified off-chain fiat deposits.
   - Subject to strict single-use, exact-amount grant limits per transaction.

3. **Compliance Admin**:
   - Responsible for maintaining the sanctions/blacklist registry.
   - Adds or removes addresses/accounts from the blacklist in response to court orders or regulatory mandates.

4. **Relayers / Gas Sponsors**:
   - Entities facilitating gasless user interactions (meta-transactions or native sponsored transactions).

5. **End Users / Token Holders**:
   - Standard accounts capable of holding, transferring, and self-burning cNGN.

---

## 4. Invariants & Business Logic Workflows

Every implementation on every blockchain must satisfy the following state invariants:

### 4.1. Single-Use Exact-Amount Mint Authorization
To eliminate the risk of infinite minting due to private key compromise or insider malfeasance:

```
[Admin / MultiSig] ---------> Grants: (Minter = Alice, Amount = 50,000,000,000)
                                            |
                                            v
[Minter (Alice)]   ---------> Requests: Mint(Recipient = Bob, Amount = 50,000,000,000)
                                            |
                                            +--- Verified: Alice is authorized? (YES)
                                            +--- Verified: Amount == 50,000,000,000? (YES)
                                            +--- Verified: Alice / Bob Blacklisted? (NO)
                                            |
                                            +===> Mint 50,000 cNGN to Bob
                                            +===> Revoke Alice's Mint Permission (Atomic)
                                            |
                                            v
[Subsequent Call]  ---------> Alice calls Mint again ===> REVERTED / FAILED
```

#### Rules:
1. An admin must explicitly assign both `can_mint = true` and `grant_amount = X` for a specific minter account.
2. The minter can only mint **exactly** amount `X`. Attempting to mint any amount $Y \neq X$ must fail.
3. Upon a successful mint, the grant is **consumed atomically** (`can_mint` set to `false` and/or `grant_amount` cleared).
4. The minter cannot mint again until the Admin issues a fresh grant.

---

### 4.2. Transfer Compliance & Blacklist Gating
Every transfer of cNGN (direct, delegated, or minted) must enforce sanction screening:

$$\text{AllowTransfer}(S, R, C) \iff (S \notin \text{Blacklist}) \land (R \notin \text{Blacklist}) \land (C \notin \text{Blacklist})$$

*Where $S$ is Sender, $R$ is Recipient, and $C$ is Caller / Spender.*

- If any involved party is blacklisted, the transaction **must fail immediately**.
- Blacklisted accounts cannot send tokens, receive tokens, approve spenders, or execute mints.

---

### 4.3. Global Pause (Secondary Market Circuit Breaker)
- When `is_paused == true`:
  - All direct transfers (`transfer`) and delegated transfers (`transferFrom`) **must revert / abort**.
  - Approvals and standard balance movements are frozen.
- Pausing protects users and reserves in the event of an upstream bridge failure, smart contract vulnerability, or market anomaly.
- Unpausing restores full ledger transferability.

---

### 4.4. User Self-Burn (Redemption)
- Any verified token holder can initiate a burn of their own tokens:
  $$\text{Balance}_{\text{caller}} \leftarrow \text{Balance}_{\text{caller}} - \text{Amount}$$
  $$\text{TotalSupply} \leftarrow \text{TotalSupply} - \text{Amount}$$
- This triggers off-chain settlement where the custodian releases the corresponding fiat NGN to the user's bank account.

---

## 5. Chain-Agnostic Interface Specification

An implementation must expose the following conceptual operations (expressed here in pseudo-types):

### 5.1. State Queries (Read-Only)

```typescript
// Metadata
function getName() -> String
function getSymbol() -> String
function getDecimals() -> UInt8 // 6

// Ledger
function getTotalSupply() -> UInt256
function getBalanceOf(account: AccountId) -> UInt256
function getAllowance(owner: AccountId, spender: AccountId) -> UInt256

// Compliance & Access Control
function isBlacklisted(account: AccountId) -> Boolean
function isPaused() -> Boolean
function canMint(minter: AccountId) -> Boolean
function getMintGrantAmount(minter: AccountId) -> UInt256
```

### 5.2. State Transitions (Mutating)

```typescript
// Standard Transfers
function transfer(recipient: AccountId, amount: UInt256) -> Result<Success, Error>
    Preconditions: 
      - Not Paused
      - Caller is not Blacklisted
      - Recipient is not Blacklisted
      - Balance(Caller) >= amount

function transferFrom(sender: AccountId, recipient: AccountId, amount: UInt256) -> Result<Success, Error>
    Preconditions: 
      - Not Paused
      - Caller, Sender, and Recipient are not Blacklisted
      - Balance(Sender) >= amount
      - Allowance(Sender, Caller) >= amount

function approve(spender: AccountId, amount: UInt256) -> Result<Success, Error>

// Issuance & Redemption
function mint(recipient: AccountId, amount: UInt256) -> Result<Success, Error>
    Preconditions:
      - Caller has canMint == true
      - Caller's grantAmount == amount
      - Caller and Recipient are not Blacklisted
    Postconditions:
      - TotalSupply increased by amount
      - Balance(Recipient) increased by amount
      - Caller's canMint set to false
      - Caller's grantAmount set to 0

function burnByUser(amount: UInt256) -> Result<Success, Error>
    Preconditions:
      - Balance(Caller) >= amount
    Postconditions:
      - TotalSupply decreased by amount
      - Balance(Caller) decreased by amount

// Governance & Administration
function grantMintPermission(minter: AccountId, amount: UInt256) -> Result<Success, Error>
    Auth: System Governance Only

function revokeMintPermission(minter: AccountId) -> Result<Success, Error>
    Auth: System Governance Only

function setBlacklist(account: AccountId, isBlacklisted: Boolean) -> Result<Success, Error>
    Auth: Compliance Admin / Governance Only

function setPause(isPaused: Boolean) -> Result<Success, Error>
    Auth: System Governance Only
```

---

## 6. Security & Threat Model Considerations

1. **Minter Key Compromise Containment**:
   - By enforcing single-use, exact-amount grants, an attacker who compromises a minter's private key cannot generate unbacked tokens unless an active, unconsumed grant exists for that exact key.
2. **Replay & Front-Running Protection**:
   - Where meta-transactions or off-chain signatures are used, implementations must enforce sequential per-user nonces, chain IDs, and domain separators.
3. **Atomic Consumption**:
   - Revocation of the mint permission must execute in the exact same atomic transaction as the token minting. Under no circumstances should token generation succeed if the permission clearing fails.
4. **Reserve Auditing & Transparency**:
   - The on-chain total supply must match the off-chain liquid fiat reserves at all times.
