// scripts/deployGnosisSafe.mjs
import dotenv from "dotenv";
import { ethers } from "ethers";
import { SafeFactory, EthersAdapter } from "@safe-global/protocol-kit";

dotenv.config();

async function main() {
  // 1. RPC + Wallet
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  if (!rpcUrl) throw new Error("Set RPC_URL in .env");
  if (!privateKey) throw new Error("Set PRIVATE_KEY in .env");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  console.log("Using ethers.Wallet signer from PRIVATE_KEY");
  const signer = new ethers.Wallet(privateKey, provider);

  // 2. Safe adapter + factory
  const ethAdapter = new EthersAdapter({ ethers, signer, provider });
  const safeFactory = await SafeFactory.create({ ethAdapter });

  // 3. Parse second owner
  const secondOwnerArg = process.argv.find((arg) =>
    arg.startsWith("--secondOwner=")
  );
  if (!secondOwnerArg) throw new Error("Missing --secondOwner");
  const secondOwner = secondOwnerArg.split("=")[1];
  if (!ethers.utils.isAddress(secondOwner))
    throw new Error("Invalid secondOwner");

  // 4. Deploy 2‑of‑2 Safe
  const firstOwner = await signer.getAddress();
  console.log("Deploying with owners:", firstOwner, secondOwner);

  const { safeSdk } = await safeFactory.deploySafe({
    safeAccountConfig: { owners: [firstOwner, secondOwner], threshold: 2 },
  });
  console.log(" Deployed Safe at:", await safeSdk.getAddress());
}

main().catch((e) => {
  console.error(" Failed:", e);
  process.exit(1);
});
