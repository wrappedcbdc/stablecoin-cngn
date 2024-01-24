require('dotenv').config()
module.exports = {
    networks: {
      development: {
        privateKey: process.env.PRIVATE_KEY_NILE,
        userFeePercentage: 100, // The percentage of resource consumption ratio.
        feeLimit: 100000000, // The TRX consumption limit for the deployment and trigger, unit is SUN
        fullHost: 'https://nile.trongrid.io/',
        network_id: '3'
      },
      compilers: {
        solc: {
          version: '0.8.0'
        }
      }
    },
     // solc compiler optimize
    solc: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: 'istanbul'
    }
  };
