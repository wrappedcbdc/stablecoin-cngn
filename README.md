# WrapCBDC Stablecoin — cNGN

## Abstract

cNGN stands apart as the first regulated stablecoin in Africa. As a fully compliant digital asset, cNGN offers unparalleled trust and transparency, ensuring security for all users, institutions, and businesses.

cNGN fosters the expansion of fintechs, liquidity providers, and virtual asset entities in Nigeria's digital economy. This initiative is bolstered by regulatory approval under the SEC's Regulatory Incubation (RI) Program, significantly contributing to the growth of Nigeria's digital asset ecosystem.

---

## Architecture Overview

<img width="1463" height="683" alt="cngn smart contract high-level view" src="https://github.com/wrappedcbdc/stablecoin-cngn/blob/main/cNGN.technical.png" />

### Core Components

**1. Cngn Token Contract**
ERC-20 compliant token with additional features for regulatory compliance:
- Pausable functionality for emergency situations
- Role-based access control for administrative functions
- Blacklisting capabilities for compliance requirements
- Meta-transaction support for gasless transactions

**2. Admin Contract**
Manages role-based access control for the ecosystem:
- Assigns and revokes roles (Admin, Minter, Blacklister, Pauser)
- Provides a centralized permission management system
- Implements multi-step processes for critical role changes

**3. Forwarder Contract**
Enables meta-transactions (gasless transactions):
- Verifies signatures from users
- Forwards transactions to the token contract
- Maintains nonce management to prevent replay attacks
- Supports bridge-authorized execution via `executeByBridge`

---

## Meta-Transaction Flow

cNGN supports gasless transactions through the ERC-2771 meta-transaction pattern:

1. **User Signing** — A user signs a transaction request off-chain with their private key
2. **Relayer Processing** — A relayer (service provider) submits the signed request to the Forwarder contract
3. **Signature Verification** — The Forwarder verifies the signature and nonce
4. **Transaction Execution** — Upon verification, the Forwarder calls the target function on the token contract
5. **Context Recovery** — The token contract recovers the original sender's address using the trusted forwarder pattern

This allows users to interact with cNGN without needing to hold native tokens (ETH, MATIC, etc.) for gas fees.

---

## Role Management

The cNGN ecosystem implements a comprehensive role-based access control system:

| Role | Permissions |
|------|-------------|
| **Admin** | Assigns other roles and manages system-wide configurations |
| **Minter** | Authorized to mint new tokens and manage supply |
| **Blacklister** | Can add or remove addresses from the blacklist |
| **Pauser** | Can pause and unpause token transfers in emergency situations |

Role transitions follow a secure process with appropriate checks and balances to prevent unauthorized access.

---

## Blockchain Deployments

cNGN is currently deployed on the following blockchain protocols:

### Mainnets

| Network | cNGN Contract Address |
| ------- | ---------------------- |
| BANTU   | GD6G2NT7CQHPIYHA52KZHWB6ONNWTSGZOOLTRLRASENM2VWSF6CHYFRX |
| ASSETCHAIN   | 0x7923C0f6FA3d1BA6EAFCAedAaD93e737Fd22FC4F |
| BASE       | 0x46C85152bFe9f96829aA94755D9f915F9B10EF5F           |
| BNBCHAIN   | 0xa8AEA66B361a8d53e8865c62D142167Af28Af058           |
| ETHEREUM   | 0x17CDB2a01e7a34CbB3DD4b83260B05d0274C8dab           |
| POLYGON    | 0x52828daa48C1a9A06F37500882b42daf0bE04C3B          |



### Test-Nets

| Network    | cNGN Contract Address                                |
| ---------- | ---------------------------------------------------- |
| BANTU      | GAE7E56N3XIC6JGJI54SD3VN4EDY3OZVFA7CLHXAMMTHLU4LIFYJMFSI |
| ASSETCHAIN | 0x00F0a33d9AFaC108A4963D4Cb4Ef6A9C6B8D8859           |
| BASE       | 0xEFdF04BAfE0ebabb5F5cD9e3f36564f51CFe1530           |
| BNBCHAIN   | 0x8a078b182bA9649c03982c2a80CDcc81cdc99dA8           |
| ETHEREUM   | 0xF55E56423e6b50808fD07cB62b6A32B91903f50E           |
| POLYGON    | 0xf24B1Cee8cA70341FcefBCa10e7e4Db9A4896486 *          |
| LISK       | 0x999E3A32eF3F9EAbF133186512b5F29fADB8a816  *         |
| MONAD      | 0x4F90098BA5b08ABAf039b95A851F8e764EB84b49  *         |
| ARC        | 0x1716Df6A18DcFF031BFD209aDB8035174AdC0D31   *        |

## Developer Guide

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/wrappedcbdc/stablecoin-cngn.git
   cd stablecoin-cngn
   ```

2. Install Foundry (if not already installed):
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

3. Install dependencies:
   ```bash
   forge install
   ```

4. Set up environment variables by creating a `.env` file in the project root:
   ```env
   # Network RPC URLs
   POLYGON_TESTNET=https://rpc-amoy.polygon.technology
   BSC_TESTNET=https://data-seed-prebsc-1-s1.binance.org:8545
   BASE_TESTNET=https://sepolia.base.org
   ASSETCHAIN_TESTNET=https://testnet-rpc.assetchain.com
   ETH_TESTNET=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
   TRON_TESTNET=https://api.shasta.trongrid.io

   POLYGON_MAINNET=https://polygon-rpc.com
   ETH_MAINNET=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
   BSC_MAINNET=https://bsc-dataseed.binance.org
   BASE_MAINNET=https://mainnet.base.org
   ASSETCHAIN_MAINNET=https://rpc.assetchain.com

   # Private key (without 0x prefix)
   EVM_PRIVATE_KEY=your_private_key_here

   # API Keys for contract verification
   ETH_API_KEY=your_etherscan_api_key
   POLYGON_API_KEY=your_polygonscan_api_key
   BSC_API_KEY=your_bscscan_api_key
   BASE_API_KEY=your_basescan_api_key
   ```

### Running Tests

The project uses [Foundry](https://book.getfoundry.sh/) for testing.

```bash
# Run all tests
forge test

# Run a specific test file
forge test --match-path test/IntegrationTest.t.sol

# Run a specific test function
forge test --match-test test_FullMetaTransactionMintFlow

# Run tests with gas reporting
forge test --gas-report

# Run tests with verbosity (useful for debugging)
forge test -vvvv
```

#### Test Coverage

End-to-end integration tests (`IntegrationTest.t.sol`) cover the full lifecycle of the contracts:

| Test | Description |
|---|---|
| `test_FullMetaTransactionMintFlow` | Full meta-transaction mint via Forwarder |
| `test_MetaTransactionFailsIfAdminBlocksMinter` | Revoked minter cannot mint via meta-tx |
| `test_MetaTransactionTransfer` | Gasless token transfer |
| `test_MetaTransactionBurn` | Gasless token burn |
| `test_BlacklistBlocksAllOperations` | Blacklist blocks transfers, burns, and meta-txs |
| `test_RedemptionFlowWithMetaTransaction` | External-to-internal transfer triggers burn |
| `test_AdminCanDestroyBlacklistedFunds` | Admin can destroy blacklisted user funds |
| `test_BridgeCanExecuteMetaTransactions` | Bridge-authorized meta-transaction execution |
| `test_NonceManagementPreventsReplay` | Replay attack prevention via nonce tracking |
| `test_PauseCascades` | Pause propagates across Admin, Token, and Forwarder |
| `test_ComplexWorkflow` | Mint, transfer, approve, and transferFrom flow |
| `test_InternalUserCanOnlyReceiveRedemption` | Internal user transfer behaviour |
| `test_MultipleMinters` | Multiple independent minters operate correctly |
| `test_RemoveAndReAddForwarder` | Forwarder role revocation and re-grant |
| `test_TrustedContractCanManageAdminOperations` | Trusted contract delegates admin operations |
| `test_WhitelistBlacklistExternalSender` | External sender whitelist management |
| `test_MintAmountManagement` | Per-minter mint limit lifecycle |
| `test_EndToEndStressTest` | Multi-user stress test across all operations |

### Deployment

```bash
# Deploy to testnet
forge script script/Deploy.s.sol --rpc-url $ETH_TESTNET --broadcast

# Deploy to mainnet (use with caution)
forge script script/Deploy.s.sol --rpc-url $ETH_MAINNET --broadcast
```

### Contract Verification

After deployment, verify the contract source code on the block explorer:

```bash
forge verify-contract DEPLOYED_CONTRACT_ADDRESS src/Cngn3.sol:Cngn3 --chain sepolia --etherscan-api-key $ETH_API_KEY
```

---

## Security Considerations

- Never commit your `.env` file or private keys to version control
- Use separate development and production keys
- Follow the principle of least privilege when assigning roles
- Thoroughly test all functionality before mainnet deployment
- Consider a professional security audit before production deployment
- Blacklisted addresses are blocked at both the token and forwarder level
- Replay attacks are prevented via per-address nonce tracking in the Forwarder

---

## License

Software license can be found [here](https://github.com/wrappedcbdc/stablecoin/blob/main/LICENSE).