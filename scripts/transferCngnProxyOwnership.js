// scripts/transferCngnProxyOwnership.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const proxyAddress = "0xe41913b7c0071D6A9EED2fA01154D7d0694084E7"; // TransparentUpgradeableProxy
  const safeAddress = "0x262275de3Cd2da2a67BB6C569158A5559f17B953";

  const Cngn = await ethers.getContractFactory("Cngn");
  const proxyAsAdmin = Cngn.attach(proxyAddress).connect(deployer);

  const currentOwner = await proxyAsAdmin.owner();
  console.log("Current owner of proxy-cngn logic:", currentOwner);

  const tx = await proxyAsAdmin.transferOwnership(safeAddress);
  await tx.wait();

  console.log(" Ownership of Cngn proxy transferred to Safe:", safeAddress);
}

main().catch((error) => {
  console.error("Transfer failed:", error);
  process.exit(1);
});
