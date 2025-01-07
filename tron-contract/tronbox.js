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
      privateKey: process.env.TRON_PRIVATE_KEY_TESTNET,
      fullHost: 'https://api.shasta.trongrid.io/wallet/deploycontract',
      headers: {
        'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY, // Add your API key
        'Content-Type': 'application/json'
      },
      userFeePercentage: 10, // The percentage of resource consumption ratio.
      feeLimit: 200000000, // The TRX consumption limit for the deployment and trigger, unit is SUN
      network_id: '*'
    },
    nile: {
      privateKey: process.env.TRON_PRIVATE_KEY_TESTNET,
      userFeePercentage: 5,
      feeLimit: 400000000,
      fullHost: 'https://nile.trongrid.io',
      headers: {
        'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY,
      },
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
}
