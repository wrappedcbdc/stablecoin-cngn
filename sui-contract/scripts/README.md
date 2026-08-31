# cNGN on Sui: Deployment, Upgrade & Interaction Guide

## 1. Upgradability on Sui

### How Upgrades Work on Sui Move
In Sui's object-centric model, contract packages are upgradeable via the **`UpgradeCap` (Upgrade Capability)**:

1. **Deployment (`sui client publish`)**:
   - The publisher account receives an `UpgradeCap` object (e.g. `0x...::package::UpgradeCap`).
   - The shared state objects (`CoinState`, `AdminRegistry`) and immutable metadata (`CoinMetadata`) are created and assigned unique object IDs.

2. **Upgrading (`sui client upgrade`)**:
   - Holding the `UpgradeCap` allows the issuer/governance to publish a new package bytecode version.
   - The existing shared objects (`CoinState` and `AdminRegistry`) **persist their object IDs, balances, and permission tables** seamlessly across package versions.
   - Sui Move guarantees backward compatibility for existing types and entry functions.

3. **Governance & Custody**:
   - In production, transfer the `UpgradeCap` and `AdminCap` to a multi-signature safe or timelock DAO.

---

## 2. Quickstart: CLI Scripts

All scripts are located in [`sui-contract/scripts/`](file:///Users/ayoseun/Documents/GitHub/Convexity/Stable-coin/stablecoin-cngn/sui-contract/scripts).

### A. Deploy Package
```bash
cd sui-contract/scripts
chmod +x *.sh
./deploy.sh
```
* Builds the package, publishes it to your active Sui network, parses all generated Object IDs, and writes them to `sui-contract/deployment.json` and `sui-contract/.env`.

### B. Upgrade Package
```bash
./upgrade.sh
```
* Reads the `upgradeCapId` from `deployment.json` and publishes the upgraded Move code, updating `deployment.json` with the new `packageId`.

---

## 3. Interaction CLI (`./interact.sh`) Reference

The interaction script covers **100% of Admin and Token operations**:

### 3.1. Admin Mint Grant Management
```bash
# Authorize a minter for an exact amount (single-use)
./interact.sh grant-mint <MINTER_ADDRESS> 50000000000

# Revoke an authorization
./interact.sh revoke-mint <MINTER_ADDRESS>
```

### 3.2. Token Issuance & Redemption
```bash
# Mint tokens to a recipient (called by authorized minter with exact amount)
./interact.sh mint 50000000000 <RECIPIENT_ADDRESS>

# Burn tokens for fiat redemption (called by token holder)
./interact.sh burn <COIN_OBJECT_ID>
```

### 3.3. Compliance & Sanctions (DenyList)
```bash
# Add an address to validator-enforced DenyList
./interact.sh add-blacklist <USER_ADDRESS>

# Remove an address from DenyList
./interact.sh remove-blacklist <USER_ADDRESS>
```

### 3.4. Emergency Circuit Breakers (Pause)
```bash
# Freeze all secondary market transfers globally
./interact.sh pause

# Restore secondary market transfers
./interact.sh unpause
```

### 3.5. Forwarder & Trusted Contract Whitelisting
```bash
# Manage meta-transaction relayers
./interact.sh add-forwarder <FORWARDER_ADDRESS>
./interact.sh remove-forwarder <FORWARDER_ADDRESS>

# Manage trusted external contracts
./interact.sh add-trusted-contract <CONTRACT_ADDRESS>
./interact.sh remove-trusted-contract <CONTRACT_ADDRESS>
```

### 3.6. Query State
```bash
./interact.sh query-state
```

---

## 4. TypeScript SDK Integration (`interact.ts`)

For backend services, relayers, and frontend applications:

```typescript
import { CNGNClient } from './interact';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const client = new CNGNClient('testnet');
const adminKeypair = Ed25519Keypair.fromSecretKey(/* privateKey */);

// 1. Grant single-use mint permission (50,000 cNGN)
await client.grantMintPermission(adminKeypair, minterAddress, 50000000000n);

// 2. Minter executes mint
await client.mint(minterKeypair, 50000000000n, recipientAddress);

// 3. Admin pauses secondary transfers in emergency
await client.pause(adminKeypair);
```
