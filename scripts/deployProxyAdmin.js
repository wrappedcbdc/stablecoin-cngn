// scripts/deployProxyAdmin.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying ProxyAdmin from:", deployer.address);

  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  const proxyAdmin = await ProxyAdmin.deploy();
  await proxyAdmin.deployed();

  console.log(" ProxyAdmin deployed at:", proxyAdmin.address);

  // MPCVault multisig (Staging)
  const MPC_MULTISIG = "0x2099C4351Cd91EF616Da9e874E1ef8944e29721a";

  console.log("Transferring ownership to MPCVault multisig:", MPC_MULTISIG);

  const tx = await proxyAdmin.transferOwnership(MPC_MULTISIG);
  await tx.wait();

  console.log(" ProxyAdmin ownership transferred to MPCVault multisig.");
}

main().catch((error) => {
  console.error(" Error during deployment:", error);
  process.exit(1);
});
