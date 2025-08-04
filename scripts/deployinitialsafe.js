require("dotenv").config();
const { ethers } = require("ethers");
const { SafeFactory } = require("@gnosis.pm/safe-core-sdk");
const EthersAdapter = require("@gnosis.pm/safe-ethers-lib").default;

async function main() {
  // 1) Load RPC + private key
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  if (!rpcUrl) throw new Error("Set RPC_URL in .env");
  if (!privateKey) throw new Error("Set PRIVATE_KEY in .env");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  console.log("First owner address:", await signer.getAddress());

  // 2) Build the Safe adapter + factory
  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer,
  });

  //  Insert Base Sepolia core‑contract addresses here:
  const CONTRACTS = {
    84532: {
      safeMasterCopyAddress: "0xa19642475509dE80ACAFd831bc7042187D36af1d",
      safeProxyFactoryAddress: "0x55abD16bC935D48D59C1f43A3Dada6e1398af79d",
      /*  safeFallbackHandlerAddress: "0x62501e3ccd97696cca7b1d4bfb85bb9134691230",
      compatibilityFallbackHandlerAddress:
        "0x62501e3cCD97696CcA7b1d4Bfb85Bb9134691230",*/
      // safeFallbackHandlerAddress: "0xf7f0407d6c1848f8dcbd4bffaba9b091a454b7bd",
      // BOTH of these point at the same on‑chain ExtensibleFallbackHandler
      // safeFallbackHandlerAddress: "0xf7f0407d6c1848f8dcbd4bffaba9b091a454b7bd",
      /* compatibilityFallbackHandlerAddress:
        "0xf7f0407d6c1848f8dcbd4bffaba9b091a454b7bd",*/
      // Use the Gnosis official fallback handler address
      safeFallbackHandlerAddress: "0xd9DB270c1B5E3Bd161E8c8503c55cdd1D4241800",
      compatibilityFallbackHandlerAddress:
        "0xd9DB270c1B5E3Bd161E8c8503c55cdd1D4241800",
    },
  };

  //  Tell the SDK to use your custom Base Sepolia deployments
  const safeFactory = await SafeFactory.create({
    ethAdapter,
    contractNetworks: CONTRACTS,
  });

  // 3) Parse secondOwner from CLI
  const arg = process.argv.find((a) => a.startsWith("--secondOwner="));
  if (!arg)
    throw new Error("Usage: node deployGnosisSafe.js --secondOwner=<address>");
  const secondOwner = arg.split("=")[1];
  if (!ethers.utils.isAddress(secondOwner))
    throw new Error("Invalid secondOwner");

  console.log("Second owner address:", secondOwner);

  // 4) Deploy a 2‑of‑2 Safe
  const safeSdk = await safeFactory.deploySafe({
    safeAccountConfig: {
      owners: [await signer.getAddress(), secondOwner],
      threshold: 2,
    },
  });

  const safeAddress = await safeSdk.getAddress();
  console.log(" Gnosis Safe deployed at:", safeAddress);
}

main().catch((err) => {
  console.error(" Deployment failed:", err);
  process.exit(1);
});
