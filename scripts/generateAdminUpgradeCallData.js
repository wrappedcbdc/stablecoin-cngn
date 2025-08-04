// scripts/generateAdminUpgradeCallData.js
const { ethers } = require("hardhat");

async function main() {
  // Define the addresses
  const proxyAdminAddress = "0x68A1C4183871f8c63a9a81aA51Ec5ad84750fEa3"; //ProxyAdmin
  const proxyToUpgrade = "0xA86C185a6A2AA9d707371f1F64F27D543f87ab1f"; // Admin1 proxy
  const newImplementation = "0x39225c5e6306ebF3b2D46d7fa29570A212c2c3a9"; // Admin2 logic

  const proxyAdminAbi = [
    "function upgrade(address proxy, address implementation) external",
  ];

  const iface = new ethers.utils.Interface(proxyAdminAbi);
  const calldata = iface.encodeFunctionData("upgrade", [
    proxyToUpgrade,
    newImplementation,
  ]);

  console.log("  Call Data for upgrade(proxy, newImpl):\n", calldata);
  console.log(" To (recipient in MPCVault):", proxyAdminAddress);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
