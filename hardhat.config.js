require('@nomicfoundation/hardhat-verify');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');
require("dotenv").config();

module.exports = {
 solidity: {
    compilers: [
      {
        version: "0.8.28", // Default compiler version
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.23", // Default compiler version
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.11", // Default compiler version
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.9", // Default compiler version
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      // {
      //   version: "0.8.7", // Default compiler version
      //   settings: {
      //     optimizer: {
      //       enabled: true,
      //       runs: 200,
      //     },
      //   },
      // },
      // {
      //   version: "0.8.4", // Default compiler version
      //   settings: {
      //     optimizer: {
      //       enabled: true,
      //       runs: 200,
      //     },
      //   },
      // },
      // {
      //   version: "0.8.0", // Additional compiler version
      //   settings: {
      //     optimizer: {
      //       enabled: true,
      //       runs: 200,
      //     },
      //   },
      // },
      {
        version: "0.6.12", // Additional compiler version
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
    enabled: false
  },
  networks: {
//     amoy: {
//       url: process.env.POLYGON_TESTNET,
//       accounts: [process.env.EVM_PRIVATE_KEY]
//     },
//   bsctestnet: {
//     url: process.env.BSC_TESTNET,
//     accounts: [process.env.EVM_PRIVATE_KEY]
//   },
//   basetestnet: {
//     url: process.env.BASE_TESTNET,
//     accounts: [process.env.EVM_PRIVATE_KEY]
//   },
//   asctestnet: {
//     url: process.env.ASSETCHAIN_TESTNET,
//     accounts: [process.env.EVM_PRIVATE_KEY]
//   },
//   ethtestnet: {
//     url: process.env.ETH_TESTNET,
//     accounts: [process.env.EVM_PRIVATE_KEY]
//   },
//   trontestnet: {
//     url: process.env.TRON_TESTNET,
//     accounts: [process.env.EVM_PRIVATE_KEY]
//   },
  polygon: {
    url:  process.env.ETH_MAINNET,
    accounts: [process.env.EVM_PRIVATE_KEY]
 },
//   ethmainnet: {
//     url: process.env.ETH_MAINNET,
//     accounts: [process.env.ETH_PK]
//     },
  // bscmainnet: {
  //     url:  process.env.ETH_MAINNET,
  //     accounts: [''],
  //     gasPrice: 3000000000 
  //   },
  basemainnet: {
      url:  process.env.ETH_MAINNET,
      accounts: [process.env.EVM_PRIVATE_KEY]
    },
  // assetchainmainnet: {
  //   url: process.env.ASSETCHAIN_MAINNET,
  //   accounts: [process.env.EVM_PRIVATE_KEY]
  // }
},
  etherscan: {
    apiKey: {
      'base': ''
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
