import "dotenv/config";
import { ethers } from "ethers";
import { SafeFactory } from "@safe-global/protocol-kit";
import { EthersAdapter } from "@safe-global/safe-ethers-lib";

async function estimateSafeDeployCost() {
  if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
    throw new Error("Set RPC_URL and PRIVATE_KEY in .env");
  }

  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer,
  });

  const safeFactory = await SafeFactory.create({ ethAdapter });

  const owners = [
    await signer.getAddress(),
    "0x03bB1C71cFb861bDEceC9D700d3633873639feA2",
  ];
  const threshold = 2;

  const deployTx = await safeFactory.getSafeDeploymentTransaction({
    safeAccountConfig: { owners, threshold },
  });

  const gasEst = await provider.estimateGas({
    to: deployTx.to,
    data: deployTx.data,
    from: await signer.getAddress(),
  });

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
  const costWei = gasEst.mul(gasPrice);

  console.log("Estimated gas:        ", gasEst.toString());
  console.log("Gas price (wei):      ", gasPrice.toString());
  console.log("Estimated Base-ETH:   ", ethers.utils.formatEther(costWei));
}

estimateSafeDeployCost().catch((e) => {
  console.error("❌ Estimation failed:", e);
  process.exit(1);
});
