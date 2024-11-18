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
    // sepolia: {
    //   url: "https://eth-sepolia.g.alchemy.com/v2/PvbeyL6n-V9RJeoFJouD_wrr1uX_cg_e",
    //   accounts: [
    //     "1841f5673f58ee1c2f6ddd759aee025b9a8a7ca742c8e0bf7edfb93c34f96355",
    //   ],
    // },
  },

  etherscan: {
    // apiKey: {
    //   sepolia: "IFCIM1ZDHR1JUABEX7I7EDY5ATH6IBK43U", // Correctly set the API key for Sepolia
    // },
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
