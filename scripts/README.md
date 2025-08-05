# Deployment Scripts Overview

This document outlines the deployment and ownership transfer flow for the **Admin** and **CNGN** contracts using upgradeable proxy architecture. The goal is to ensure a seamless, transparent, and secure deployment process while appropriately delegating ownership to Safe and MPCVault multisig wallets.

---

## Project Structure and Flow

Each smart contract goes through a structured process:

1. **Deploy ProxyAdmin (if needed)**
2. **Deploy Logic Contract**
3. **Initialize Logic (if required)**
4. **Deploy TransparentUpgradeableProxy**
5. **Transfer Ownership**
6. **Upgrade (when needed)**

Ownership of proxies and logic contracts is transferred either to a **Safe wallet** or **MPCVault multisig**, depending on the security flow.

---

## Scripts Breakdown

### Proxy Admin Deployment

- **`deployProxyAdmin.js`**
  Deploys the `ProxyAdmin` contract and transfers ownership to the MPCVault multisig.

---

### Admin Contract (Version 1)

- **`deployAdmin1Logic.js`**
  Deploys the Admin V1 logic contract, initializes it, and transfers ownership to the Safe.

- **`deployAdmin1Proxy.js`**
  Deploys the TransparentUpgradeableProxy for Admin V1, linking it to the ProxyAdmin and implementation contract.

- **`transferAdminProxyOwnership.js`**
  Transfers ownership of the Admin proxy to the Safe.

---

### Forwarder Contract

- **`deployForwarder.js`**
  Deploys the Forwarder contract, linking it to the Admin Operations (Admin V1 proxy) and transfers ownership to the Safe.

---

### Admin Contract (Version 2 - Upgrade)

- **`deployAdmin2Impl.js`**
  Deploys the Admin V2 logic contract, initializes it, and transfers ownership to the Safe.

- **`generateAdminUpgradeCallData.js`**
  Generates the calldata for upgrading the Admin proxy from V1 to V2 via the ProxyAdmin. This data is used for multisig execution (MPCVault).

---

### CNGN Contract (Version 1)

- **`deployCngn1Logic.js`**
  Deploys the CNGN V1 logic contract, initializes it with `trustedForwarder` and `adminOperations`, then transfers ownership to the Safe.

- **`deployCngn1Proxy.js`**
  Deploys the proxy for CNGN V1, linking it to the logic contract and ProxyAdmin.

- **`transferCngnProxyOwnership.js`**
  Transfers ownership of the CNGN proxy to the Safe.

---

### CNGN Contract (Version 2 - Upgrade)

- **`deployCngn2Logic.js`**
  Deploys the CNGN V2 logic contract, initializes it, and transfers ownership to the Safe.

- **`generateCngnUpgradeCallData.js`**
  Generates the calldata for upgrading the CNGN proxy from V1 to V2. The calldata is to be submitted via the MPCVault multisig.

---

## Notes on Security and Ownership

- All final contract ownerships (logic and proxies) are handed off to either a **Safe** or the **MPCVault** to ensure non-custodial, multi-actor governance.
- Upgrade actions are only performed via the ProxyAdmin, which is secured by the MPCVault.
- All calldata generated for upgrade purposes is used strictly within a secure multisig environment.

---

## Summary

This deployment flow ensures:

- Modular upgradeability via proxies.
- Proper ownership transfer to secure vaults.
- Flexibility for future upgrades.
- Compatibility with Gnosis Safe and Hardhat scripting.

Let the engineering team follow the script flow in order, and use the generated calldata wherever applicable for multisig approval.
