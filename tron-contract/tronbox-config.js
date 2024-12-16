require("dotenv").config();

module.exports = {
  networks: {
    shasta: {
      userFeePercentage: 100, // The percentage of resource consumption ratio.
      feeLimit: 100000000, // The TRX consumption limit for the deployment and trigger, unit is SUN
      privateKey:'d5d9edc2a6a13b50f4b6dd760d6ae070ccc5000d197d915497a740de58420f31',
      fullHost: "https://api.shasta.trongrid.io",
      network_id: "2", // Shasta testnet
    },
  },
  compilers: {
    solc: {
      version: "0.8.7",
    },
  },
  // solc compiler optimize
  solc: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    evmVersion: "istanbul",
  },
};
