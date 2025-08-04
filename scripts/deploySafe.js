const hre = require("hardhat");
const { ethers } = hre;
const { SafeFactory } = require("@safe-global/safe-core-sdk");
const EthersAdapter = require("@safe-global/safe-ethers-lib").default;
const contractAddresses = require("../safe-contracts.json");
const provider = new ethers.providers.JsonRpcProvider(process.env.BASE_TESTNET);
const signer = new ethers.Wallet(process.env.EVM_PRIVATE_KEY, provider);

async function deploySafe() {
  // Check if the signer is connected to a provider
  if (!signer.provider) {
    throw new Error("Signer is not connected to a provider");
  }

  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer,
  });

  const chainId = (await signer.provider.getNetwork()).chainId;

  const safeFactory = await SafeFactory.create({
    ethAdapter,
    contractNetworks: {
      chainId: {
        safeMasterCopyAddress: contractAddresses.safeMasterCopyAddress,
        safeProxyFactoryAddress: contractAddresses.safeProxyFactoryAddress,
        fallbackHandlerAddress: contractAddresses.fallbackHandlerAddress,
        multiSendAddress: contractAddresses.multiSendAddress,
        multiSendCallOnlyAddress: contractAddresses.multiSendCallOnlyAddress,
        signMessageLibAddress: contractAddresses.signMessageLibAddress,
        createCallAddress: contractAddresses.createCallAddress,
      },
    },
  });

  const owners = [
    "0x1333946C8F7e30A74f6934645188bf75A13688Be",
    "0xA9E69cE29106808a58DA2cC1c2edb421Bd1a9C28",
  ];
  const threshold = 2;

  const safeAccountConfig = { owners, threshold };
  const safeSdk = await safeFactory.deploySafe({ safeAccountConfig });

  const newSafeAddress = await safeSdk.getAddress();
  console.log("New Safe address:", newSafeAddress);
}

deploySafe()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
