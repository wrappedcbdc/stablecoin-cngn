# WrapCBDC stablecoin - cNGN
## Abstract
cNGN stands apart as the first regulated stablecoin in Africa. As a fully compliant digital asset, cNGN offers unparalleled trust and transparency, ensuring security for all users, institutions, and businesses.

cNGN, fosters the expansion of fintechs, liquidity providers, and virtual asset entities in Nigeria's digital economy. This initiative is bolstered by regulatory approval under the SEC's Regulatory Incubation (RI) Program, significantly contributing to the growth of Nigeria's digital asset ecosystem.

## Architecture Overview

The cNGN stablecoin implementation follows a modular architecture with the following key components:

### Core Components

1. **Cngn Token Contract**: ERC-20 compliant token with additional features for regulatory compliance, including:
   - Pausable functionality for emergency situations
   - Role-based access control for administrative functions
   - Blacklisting capabilities for compliance requirements
   - Meta-transaction support for gasless transactions

2. **Admin Contract**: Manages role-based access control for the ecosystem:
   - Assigns and revokes roles (Admin, Minter, Blacklister, Pauser)
   - Provides a centralized permission management system
   - Implements multi-step processes for critical role changes

3. **Forwarder Contract**: Enables meta-transactions (gasless transactions):
   - Verifies signatures from users
   - Forwards transactions to the token contract
   - Maintains nonce management to prevent replay attacks

### Meta-Transaction Flow

The cNGN implementation supports gasless transactions through the ERC-2771 meta-transaction pattern:

1. **User Signing**: A user signs a transaction request off-chain with their private key
2. **Relayer Processing**: A relayer (service provider) submits the signed request to the Forwarder contract
3. **Signature Verification**: The Forwarder verifies the signature and nonce
4. **Transaction Execution**: Upon verification, the Forwarder calls the target function on the token contract
5. **Context Recovery**: The token contract recovers the original sender's address using the trusted forwarder pattern

This approach allows users to interact with the cNGN token without needing to hold native tokens (ETH, MATIC, etc.) for gas fees.

### Role Management

The cNGN ecosystem implements a comprehensive role-based access control system:

- **Admin Role**: Can assign other roles and manage system-wide configurations
- **Minter Role**: Authorized to mint new tokens and manage supply
- **Blacklister Role**: Can add or remove addresses from the blacklist
- **Pauser Role**: Can pause and unpause token transfers in emergency situations

Role transitions follow a secure process with appropriate checks and balances to prevent unauthorized access.

## Blockchain
cNGN is currently deployed on the following blockchain protocols:

### Main-Nets

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
| ASSETCHAIN | 0x069404d2F76Aa4519819a41B4E385074A9F4E8eA           |
| BASE       | 0x7E29CF1D8b1F4c847D0f821b79dDF6E67A5c11F8           |
| BNBCHAIN   | 0xA8945B7B12a3808EFD68B072b54E6dae4f0d7AEa           |
| ETHEREUM   | 0xA1A8892a746685FD8ae09FdCfAdce89fF6FB7234           |
| POLYGON    | 0x1BE5EaCb5D503fe8D64c810a0b14cdD7eC48df1f          |

## Developer Guide

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/wrappedcbdc/stablecoin-cngn.git
   cd stablecoin-cngn
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file in the project root
   - Add the following variables (replace with your values):
   ```
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
   
   # API Keys for verification
   ETH_API_KEY=your_etherscan_api_key
   POLYGON_API_KEY=your_polygonscan_api_key
   BSC_API_KEY=your_bscscan_api_key
   BASE_API_KEY=your_basescan_api_key
   ```

### Running Tests

The project uses Hardhat for testing. To run the test suite:

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test ./test/execute.js

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test

# Run tests with coverage report
npx hardhat coverage
```

### Test Structure

Tests are organized by contract functionality:

- `Cngn.test.js`: Tests for basic ERC-20 functionality
- `CngnAdmin.test.js`: Tests for role management and administrative functions
- `CngnBlacklist.test.js`: Tests for blacklisting functionality
- `CngnForwarder.test.js`: Tests for meta-transaction functionality
- `CngnPause.test.js`: Tests for pause/unpause functionality

### Deployment

To deploy contracts to a network:

```bash
# Deploy to testnet
npx hardhat run scripts/deploy.js --network sepolia

# Deploy to mainnet (use with caution)
npx hardhat run scripts/deploy.js --network mainnet
```

### Verification

After deployment, verify contract source code:

```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

## Security Considerations

- Never commit your `.env` file or private keys to version control
- Use separate development and production keys
- Follow the principle of least privilege when assigning roles
- Thoroughly test all functionality before mainnet deployment
- Consider professional security audits for production deployments

## License
Software license can be found [here](https://github.com/wrappedcbdc/stablecoin/blob/main/LICENSE)
