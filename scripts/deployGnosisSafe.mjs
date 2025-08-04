// scripts/deployGnosisSafe.mjs
import "dotenv/config";
import { ethers } from "ethers";
import { SafeFactory, EthersAdapter } from "@safe-global/protocol-kit";
import safeDeployments from "@safe-global/safe-deployments";
const { chains } = safeDeployments; // Base Mainnet (chainId 8453) included by default

async function main() {
  // 1) Provider + Signer
  if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
    throw new Error("Set RPC_URL and PRIVATE_KEY in .env");
  }
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // 2) Adapter + Factory
  //const ethAdapter = new EthersAdapter({ ethers, signer, provider });
  // 2) Adapter + Factory
  //    ⚠️ Pass your Wallet as `signerOrProvider`—the adapter will
  //    pick up `signMessage` from it and `getNetwork` via its .provider.
  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer,
  });
  const safeFactory = await SafeFactory.create({ ethAdapter, chains });

  // 3) Parse secondOwner from CLI
  const arg = process.argv.find((a) => a.startsWith("--secondOwner="));
  if (!arg) {
    console.error("Usage: node deployGnosisSafe.mjs --secondOwner=<address>");
    process.exit(1);
  }
  const secondOwner = arg.split("=")[1];
  if (!ethers.utils.isAddress(secondOwner)) {
    throw new Error("Invalid secondOwner");
  }

  // 4) Deploy your 2-of-2 Safe
  const firstOwner = await signer.getAddress();
  console.log("Deploying Safe with owners:", firstOwner, secondOwner);

  /*const { safeSdk } = await safeFactory.deploySafe({
    safeAccountConfig: {
      owners: [firstOwner, secondOwner],
      threshold: 2,
    },
  });

  console.log("✅ Gnosis Safe deployed at:", await safeSdk.getAddress());*/

  // 4) Deploy your 2-of-2 Safe
  const safeSdk = await safeFactory.deploySafe({
    safeAccountConfig: {
      owners: [firstOwner, secondOwner],
      threshold: 2,
    },
  });

  console.log("✅ Gnosis Safe deployed at:", await safeSdk.getAddress());
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
