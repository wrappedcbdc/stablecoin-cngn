const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.BOSS_PRIVATE_KEY, provider);

  console.log("Deployer address:", signer.address);
}

main();
