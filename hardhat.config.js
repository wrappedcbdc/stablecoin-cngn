require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.23",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["metadata", "evm.bytecode", "evm.sourceMap"],
        },
      },
    },
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
  ethtestnet: {
    url: process.env.ETH_TESTNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
  },
  trontestnet: {
    url: process.env.TRON_TESTNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
  },
  polygon: {
    url: process.env.POLYGON_MAINNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
 },
  ethmainnet: {
    url: process.env.ETH_MAINNET,
    accounts: [process.env.ETH_PK]
    },
  bscmainnet: {
      url: process.env.BSC_MAINNET,
      accounts: [process.env.EVM_PRIVATE_KEY],
      gasPrice: 3000000000 
    },
  basemainnet: {
      url: process.env.BSC_MAINNET,
      accounts: [process.env.EVM_PRIVATE_KEY]
    },
  assetchainmainnet: {
    url: process.env.ASSETCHAIN_MAINNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
  }
  },
  // etherscan: {
  //   apiKey: { goerli: process.env.ETH_API_KEY}
  // },
  // etherscan: {
  //   apiKey: process.env.API_KEY
  // },
  etherscan: {
    apiKey: process.env.BASE_API_KEY,
    customChains: [
      {
        network: "basetestnet",
        chainId: 5,
        urls: {
          apiURL: "https://api-goerli.etherscan.io/api",
          browserURL: "https://goerli.etherscan.io"
        }
      }
    ]
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
