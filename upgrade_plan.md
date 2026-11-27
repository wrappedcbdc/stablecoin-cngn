# cNGN on Sui: Comprehensive Smart Contract Upgrade Guide

## 1. Overview & Sui Upgrade Architecture

Upgrading smart contracts on Sui differs fundamentally from EVM proxy patterns (such as UUPS or Transparent Proxies). On Sui:

- **Immutable Package History**: When a package is upgraded, the old package version remains on-chain (immutable), and a **new package ID** is generated.
- **Shared State Persistence**: The shared objects—**`CoinState`** (holding `TreasuryCap` and `DenyCapV2`) and **`AdminRegistry`** (holding minter permissions and caps)—**keep their exact object IDs, balances, and permissions**. They are NOT recreated.
- **Upgrade Authority (`UpgradeCap`)**: The entity holding the `UpgradeCap<package>` has exclusive cryptographic authority to publish new bytecode versions.

```
                          +-------------------------------+
                          |    Admin / MultiSig Wallet    |
                          +---------------+---------------+
                                          |
                                 Holds UpgradeCap
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
        +-------------------------+               +-------------------------+
        |   Package v1 (0xAAA)    |               |   Package v2 (0xBBB)    |
        |  (Original Bytecode)    |               |   (Upgraded Bytecode)   |
        +------------+------------+               +------------+------------+
                     |                                         |
                     +--------------------+--------------------+
                                          |
                              Operates On The Same State
                                          |
                                          v
                      +---------------------------------------+
                      |          SHARED STATE OBJECTS         |
                      |  - CoinState (TreasuryCap, DenyCap)   |
                      |  - AdminRegistry (Minter grants)      |
                      |  - CoinMetadata (Decimals, Name)      |
                      +---------------------------------------+
```

---

## 2. Sui Move Upgrade Compatibility Rules

Sui enforces strict compatibility constraints before permitting an upgrade under the default `UpgradePolicy::COMPATIBLE`:

### ✅ Allowed Changes
1. **Function Logic**: Modifying function bodies, internal helper logic, and gas optimizations.
2. **New Functions**: Adding new `public`, `entry`, or `public(package)` functions.
3. **New Modules**: Adding entirely new `.move` modules to the package.
4. **New Structs**: Defining new structs with abilities.
5. **Private Structs & Fields**: Adding or modifying private structs that are not exposed as public types across module boundaries.

### ❌ Prohibited / Breaking Changes
1. **Existing Struct Signatures**: Deleting or reordering fields in existing public structs.
2. **Existing Public Function Signatures**: Removing or altering the type parameters, argument types, or return types of existing `public` functions.
3. **Module Deletion**: Deleting an existing module from the package.
4. **Changing Struct Abilities**: Adding or removing abilities (`key`, `store`, `copy`, `drop`) on existing public structs.

---

## 3. Step-by-Step Upgrade Procedures

### Method 1: Automated Script Upgrade (Recommended)

This automated process builds the bytecode, calls the Sui client upgrade API with the `UpgradeCap`, captures the new package ID, and automatically updates `deployment.json` and `.env`.

```bash
# Step 1: Make your Move code updates in sui-contract/sources/
# Example: Add new functionality or update internal logic

# Step 2: Verify all unit tests pass
make test

# Step 3: Execute the upgrade script
make upgrade
```

#### Output Example:
```
============================================================
  Upgrading cNGN Move Package
============================================================
Current Package ID:   0x7a89...
Using UpgradeCap ID:  0x1c44...
Gas Budget:           150000000
------------------------------------------------------------
=== [1/3] Building Move bytecode for upgrade ===
=== [2/3] Publishing bytecode upgrade via UpgradeCap ===
=== [3/3] Updating deployment configuration ===
✓ Upgrade successful!
New Package ID: 0x9b12...

============================================================
  Upgrade Complete!
============================================================
  Previous Package ID: 0x7a89...
  Active Package ID:   0x9b12...
  Synced to:           deployment.json & .env
============================================================
```

---

### Method 2: Manual Sui CLI Upgrade

If performing a manual deployment via terminal:

```bash
# 1. Build the Move package
cd sui-contract
sui move build

# 2. Get your UpgradeCap ID from deployment.json
UPGRADE_CAP_ID=$(jq -r '.upgradeCapId' deployment.json)

# 3. Publish the upgrade
sui client upgrade \
  --upgrade-capability "${UPGRADE_CAP_ID}" \
  --gas-budget 150000000

# 4. Copy the newly published Package ID from the output
# 5. Update your off-chain SDKs / indexers to point to the new Package ID
```

---

### Method 3: Programmatic TypeScript Upgrade

For continuous integration (CI/CD) pipelines or backend automated runners:

```typescript
import { upgradePackage } from './sui-contract/scripts/upgrade';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

async function main() {
  const adminKeypair = Ed25519Keypair.fromSecretKey(
    Buffer.from(process.env.SUI_ADMIN_PRIVATE_KEY!, 'hex')
  );

  const newPackageId = await upgradePackage(adminKeypair, 'testnet');
  console.log(`Successfully upgraded to Package ID: ${newPackageId}`);
}

main().catch(console.error);
```

---

### Method 4: Multi-Signature / Governance DAO Upgrade

For production environments where the `UpgradeCap` is held by a multi-signature address or governance committee:

1. **Generate the Package Digest**:
   ```bash
   sui move build --dump-bytecode-as-base64 > build_output.json
   ```
2. **Authorize Upgrade**:
   - Construct a transaction calling `0x2::package::authorize_upgrade(upgrade_cap, policy, digest)`.
   - Submit proposal to the multi-signature committee for required threshold signatures.
3. **Execute Upgrade Transaction**:
   - Execute `tx.upgrade(...)` using the generated `UpgradeTicket`.
4. **Commit Upgrade**:
   - Call `0x2::package::commit_upgrade(upgrade_cap, receipt)` to advance the capability version.

---

## 4. Post-Upgrade Verification Checklist

After upgrading the package, perform the following smoke tests to confirm state integrity:

| Step | Action | Command / Target | Expected Result |
| :--- | :--- | :--- | :--- |
| **1** | Verify Total Supply | `make query-state` | Total supply must exactly match the pre-upgrade balance |
| **2** | Verify Admin Registry | `make query-state` | Minter authorizations and forwarders must be preserved |
| **3** | Test Minting Flow | `make mint-full MINTER=0x... AMOUNT=1000000 RECIPIENT=0x...` | Minting executes successfully and consumes grant |
| **4** | Test Redemption (Burn) | `make burn COIN_ID=0x...` | User self-burn executes properly |
| **5** | Test Sanctions | `make blacklist USER=0x...` | Address added to DenyList and blocked |
| **6** | Test Circuit Breaker | `make pause && make unpause` | Pause freezes and unpause unfreezes transfers |

---

## 5. Rollback & Emergency Contingency

1. **What if an upgrade transaction fails?**
   - The `UpgradeCap` remains at its previous version. The existing package version continues operating without disruption.
2. **What if a bug is found in the new package version?**
   - Because all shared state (`CoinState`, `AdminRegistry`) is independent of package bytecode, client applications and frontend interfaces can immediately switch their RPC calls back to the **previous Package ID** (`packageHistory` in `deployment.json`).
   - A subsequent patch upgrade can then be published with the fix.
