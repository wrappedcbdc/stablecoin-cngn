require("dotenv").config();

module.exports = {
  networks: {
    development: {
      userFeePercentage: 100, // The percentage of resource consumption ratio.
      feeLimit: 100000000, // The TRX consumption limit for the deployment and trigger, unit is SUN
      privateKey:
        process.env.KEY,
      fullHost: "https://api.shasta.trongrid.io",
      network_id: "2", // Shasta testnet
    },
  },
  compilers: {
    solc: {
      version: "0.8.0",
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
