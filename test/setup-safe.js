const { ethers } = require('hardhat');
const Safe = require('@gnosis.pm/safe-core-sdk');
const EthersAdapter = require('@gnosis.pm/safe-ethers-lib');
const { CloudHsmSigner } = require('../scripts/cloudhsm-signer');

async function setupSafe({ signerType = 'ethers', signerIndex = 0, owners = [], threshold = 2 } = {}) {
  // Determine signer based on type
  let signer;
  if (signerType === 'cloudhsm') {
    // Initialize CloudHsmSigner (loads config from env)
    signer = new CloudHsmSigner();
  } else {
    // Default to ethers signer
    const signers = await ethers.getSigners();
    signer = signers[signerIndex];
  }

  // Resolve owner addresses
  let ownerAddresses;
  if (owners.length > 0) {
    // If specific owner list provided, use their addresses (ethers Signer or CloudHsmSigner)
    ownerAddresses = await Promise.all(
      owners.map(async (o) => {
        if (typeof o === 'string') return o;
        // assume o is a Signer-like object
        return await o.getAddress();
      })
    );
  } else {
    // Otherwise use the single signer as owner
    const addr = await signer.getAddress();
    ownerAddresses = [addr];
  }

  // Build Ethereum adapter for Safe SDK
  const ethAdapter = new EthersAdapter({
    ethers,
    signer,
  });

  // Create Safe factory
  const safeFactory = await Safe.create({ ethAdapter });

  // Deploy Safe with owners and threshold
  const safeAccountConfig = {
    owners: ownerAddresses,
    threshold,
  };
  const safeSdk = await safeFactory.deploySafe({ safeAccountConfig });
  const safeAddress = await safeSdk.getAddress();

  return {
    safeSdk,
    safeAddress,
    ownerSigner: signer,
    ownerAddresses,
    threshold,
  };
}

module.exports = {
  setupSafe,
};