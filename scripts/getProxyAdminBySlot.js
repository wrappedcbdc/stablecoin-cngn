// scripts/getProxyAdminBySlot.js
const { ethers } = require("hardhat");

async function main() {
  const proxyAddress = "0xC94dFeeF86513f81c78fc105Ae89b8766888b3Cc";

  // Admin slot: keccak256("eip1967.proxy.admin") - 1
  const adminSlot =
    "0xb53127684a568b3173ae13b9f8a6016e01c8c8d7913e8c66c0c5c212f5e2c8b8";
  const admin = await ethers.provider.getStorageAt(proxyAddress, adminSlot);

  const adminAddress = ethers.utils.getAddress("0x" + admin.slice(26));
  console.log("Admin of proxy:", adminAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
