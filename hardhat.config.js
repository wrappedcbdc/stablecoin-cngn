require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config()

module.exports = {
  solidity: "0.8.23",
  networks: {
    mumbai: {
      url: process.env.RPC_URL,
      accounts: [process.env.PRIVATE_KEY]
    },
  //   polygon: {
  //     url: process.env.BLOCKCHAINSERV,
  //     accounts: [process.env.PRIVATE_KEY]
  // },
  // bsctestnet: {
  //   url: process.env.BSC_URL,
  //   accounts: [process.env.PRIVATE_KEY]
  // },
  // goerli: {
  //   url: process.env.ETH_URL,
  //   accounts: [process.env.PRIVATE_KEY]
  // }
  },
  // etherscan: {
  //   apiKey: { goerli: process.env.REAL_ETHERSCAN_API_KEY}
  // },
  // etherscan: {
  //   apiKey: process.env.BSCSCAN_API_KEY
  // },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 20000
  }
};