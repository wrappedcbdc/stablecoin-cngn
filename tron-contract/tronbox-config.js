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
    development: {
      // privateKey: process.env.TRON_PRIVATE_KEY_LOCALNET,
      privateKey: 'da146374a75310b9666e834ee4ad0866d6f4035967bfc76217c5a495fff9f0d0',
      consume_user_resource_percent: 30,
      fee_limit: 100000000,
      fullNode: "http://127.0.0.1:8090",
      solidityNode: "http://127.0.0.1:8091",
      eventServer: "http://127.0.0.1:8092",
      network_id: "*"
    },
    shasta: {
      privateKey: process.env.TRON_PRIVATE_KEY_TESTNET,
      fullHost: 'https://api.shasta.trongrid.io',
      headers: {
        'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY, // Add your API key
        'Content-Type': 'application/json'
      },
      userFeePercentage: 1, // The percentage of resource consumption ratio.
      feeLimit: 2000000000000000, // The TRX consumption limit for the deployment and trigger, unit is SUN
      network_id: '*'
    },
    nile: {
      privateKey: process.env.TRON_PRIVATE_KEY_TESTNET,
      userFeePercentage: 1,
      feeLimit: 15000000000,
      fullHost: 'https://nile.trongrid.io',

      network_id: '*'
    },
  },
  compilers: {
    solc: {
      version: '0.8.0',
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: 'istanbul'
    },
    solc: {
      version: '0.8.6',
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: 'istanbul'
    },
    solc: {
      version: '0.8.20',
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: 'istanbul'
    }

  },
}
