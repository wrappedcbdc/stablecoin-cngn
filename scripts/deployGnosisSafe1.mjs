// scripts/deployGnosisSafe.js
/*import dotenv from "dotenv";
import { ethers } from "ethers";
import { SafeFactory, EthersAdapter } from "@safe-global/protocol-kit";
import { chains } from "@safe-global/safe-deployments";*/

require("dotenv").config();

const { ethers } = require("ethers");
const { SafeFactory, EthersAdapter } = require("@safe-global/protocol-kit");
const { chains } = require("@safe-global/safe-deployments");

//dotenv.config();

async function main() {
  // 1) Load RPC + private key
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  if (!rpcUrl) throw new Error("Set RPC_URL in .env");
  if (!privateKey) throw new Error("Set PRIVATE_KEY in .env");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  // 2) Build the Safe adapter + factory
  const ethAdapter = new EthersAdapter({ ethers, signer, provider });
  // const ethAdapter = new EthersAdapter({ ethers, signer });
  const safeFactory = await SafeFactory.create({ ethAdapter, chains });

  // 3) Parse secondOwner from CLI
  const arg = process.argv.find((a) => a.startsWith("--secondOwner="));
  if (!arg)
    throw new Error("Usage: node deployGnosisSafe.js --secondOwner=<address>");
  const secondOwner = arg.split("=")[1];
  if (!ethers.utils.isAddress(secondOwner))
    throw new Error("Invalid secondOwner");

  // 4) Deploy a 2-of-2 Safe
  const firstOwner = await signer.getAddress();
  console.log("Deploying Safe with owners:", firstOwner, secondOwner);

  const { safeSdk } = await safeFactory.deploySafe({
    safeAccountConfig: { owners: [firstOwner, secondOwner], threshold: 2 },
  });

  const safeAddress = await safeSdk.getAddress();
  console.log("✅ Gnosis Safe deployed at:", safeAddress);
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
