require("dotenv").config();
require('@nomicfoundation/hardhat-verify');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');

/**
 * Hardhat Configuration
 * 
 * This configuration uses a consolidated set of Solidity compiler versions:
 * - 0.8.28: Primary version for new development
 * - 0.8.0: For compatibility with existing 0.8.x contracts
 * - 0.6.12: For legacy contracts or dependencies
 * 
 * All versions use consistent optimizer settings for gas efficiency.
 */

module.exports = {
 solidity: {
    compilers: [
      {
        version: "0.8.28", // Primary compiler version for new contracts
        settings: {
          optimizer: {
            enabled: true,
            runs: 200, // Standard optimization setting for balanced gas efficiency
          },
        },
      },
      {
        version: "0.8.0", // Maintained for compatibility with 0.8.x contracts
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.12", // Maintained for legacy contracts or dependencies
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  sourcify: {
    enabled: true
  },
  networks: {
    amoy: {
      url: process.env.POLYGON_TESTNET,
      accounts: [process.env.EVM_PRIVATE_KEY]
    },
  bsctestnet: {
    url: process.env.BSC_TESTNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
  },
  basetestnet: {
    url: process.env.BASE_TESTNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
  },
  asctestnet: {
    url: process.env.ASSETCHAIN_TESTNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
  },
  sepolia: {
    url: process.env.ETH_TESTNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
  },
  trontestnet: {
    url: process.env.TRON_TESTNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
  },

  polygon: {
    url:  process.env.POLYGON_MAINNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
 },
 mainnet: {
    url: process.env.ETH_MAINNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
    },
  bsc: {
      url:  process.env.BSC_MAINNET,
      accounts: [process.env.EVM_PRIVATE_KEY],
      gasPrice: 3000000000 
    },
  base: {
      url:  process.env.BASE_MAINNET,
      accounts: [process.env.EVM_PRIVATE_KEY]
    },
  assetchain: {
    url: process.env.ASSETCHAIN_MAINNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
  }
},
etherscan: {
  enabled: true,
  apiKey: {
      mainnet: process.env.ETH_API_KEY,
      sepolia: process.env.ETH_API_KEY,
      base: process.env.BASE_API_KEY,
      baseSepolia: process.env.BASE_API_KEY,
      polygon: process.env.POLYGON_API_KEY,
      polygonAmoy: process.env.POLYGON_API_KEY,
      bsc: process.env.BSC_API_KEY,
      bscTestnet: process.env.BSC_API_KEY
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 20000,
  },
};
