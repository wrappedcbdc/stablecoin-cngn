// scripts/transferAdminProxyOwnership.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const proxyAddress = "0x45cd4Db257788f213667020004F730014840eCC7"; // TransparentUpgradeableProxy
  const safeAddress = "0x262275de3Cd2da2a67BB6C569158A5559f17B953";

  const Admin = await ethers.getContractFactory("Admin");
  const proxyAsAdmin = Admin.attach(proxyAddress).connect(deployer);

  const currentOwner = await proxyAsAdmin.owner();
  console.log("Current owner of proxy-admin logic:", currentOwner);

  const tx = await proxyAsAdmin.transferOwnership(safeAddress);
  await tx.wait();

  console.log(" Ownership of Admin proxy transferred to Safe:", safeAddress);
}

main().catch((error) => {
  console.error("Transfer failed:", error);
  process.exit(1);
});
