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
    // mumbai: {
    //   url: process.env.POLYGON_TESTNET,
    //   accounts: [process.env.EVM_PRIVATE_KEY]
    // },
  // bsctestnet: {
  //   url: process.env.BSC_TESTNET,
  //   accounts: [process.env.EVM_PRIVATE_KEY]
  // },
//   polygon: {
//     url: process.env.POLYGON_MAINNET,
//     accounts: [process.env.EVM_PRIVATE_KEY]
//  },
//   ethmainnet: {
//     url: process.env.ETH_MAINNET,
//     accounts: [process.env.EVM_PRIVATE_KEY]
//     },
//   bscmainnet: {
//       url: process.env.BSC_MAINNET,
//       accounts: [process.env.EVM_PRIVATE_KEY]
//     },
//   basemainnet: {
//       url: process.env.BSC_MAINNET,
//       accounts: [process.env.EVM_PRIVATE_KEY]
//     },
//   assetchainmainnet: {
//     url: process.env.ASSETCHAIN_MAINNET,
//     accounts: [process.env.EVM_PRIVATE_KEY]
//   }
  // goerli: {
  //   url: process.env.ETH_TESTNET,
  //   accounts: [process.env.EVM_PRIVATE_KEY]
  // }
  },
  // etherscan: {
  //   apiKey: { goerli: process.env.ETH_API_KEY}
  // },
  // etherscan: {
  //   apiKey: process.env.API_KEY
  // },
  etherscan: {
    apiKey: process.env.POLYGON_API_KEY
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
