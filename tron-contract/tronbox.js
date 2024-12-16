require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

module.exports = {
  networks: {
    // mainnet: {
    //   // Don't put your private key here:
    //   privateKey: process.env.PRIVATE_KEY_MAINNET,
    //   /*
    //     Create a .env file (it must be gitignored) containing something like:

    //     export PRIVATE_KEY_MAINNET=4E7FEC...656243

    //     Then, run the migration with:

    //     source .env && tronbox migrate --network mainnet
    //   */
    //   userFeePercentage: 100,
    //   feeLimit: 1000 * 1e6,
    //   fullHost: 'https://api.trongrid.io',
    //   network_id: '1'
    // },
    shasta: {
      privateKey: process.env.EVM_PRIVATE_KEY_TESTNET,
      // userFeePercentage: 50,
      feeLimit: 2000 * 1e6,
      fullHost: 'https://api.shasta.trongrid.io',
      userFeePercentage: 100, // The percentage of resource consumption ratio.
      feeLimit: 100000000, // The TRX consumption limit for the deployment and trigger, unit is SUN
      // fullNode: 'https://api.nileex.io',
      // solidityNode: 'https://api.nileex.io',
      // eventServer: 'https://event.nileex.io',
      network_id: '*'
    },
    nile: {
      privateKey: process.env.EVM_PRIVATE_KEY_TESTNET,
      userFeePercentage: 20, // The percentage of resource consumption ratio.
      feeLimit: 400000000, // The TRX consumption limit for the deployment and trigger, unit is SUN
      fullNode: 'https://api.nileex.io',
      solidityNode: 'https://api.nileex.io',
      eventServer: 'https://event.nileex.io',
      network_id: '*'
    },
  },
  compilers: {
    solc: {
      version: '0.8.11',
      optimizer: {
        enabled: true,
        runs: 200
      },
     evmVersion: 'istanbul'
    },
  },
};

