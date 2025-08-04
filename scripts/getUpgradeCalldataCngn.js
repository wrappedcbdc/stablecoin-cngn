// scripts/getUpgradeCalldataCngn.js
const { ethers } = require("hardhat");

async function main() {
  const proxyAdminAddress = "0xA00DE410AC3ED7500556AE7FE6ea4bE8E41024fD";
  const proxyAddress = "0xEa94abeF20D295e97F4AD2383E0a8C65A182FF1a"; // Cngn Proxy
  const newImplAddress = "0x558017f7E3a98D1fB028cC8C6b1db2aEaAEC1549"; // CngnV2 Implementation

  const proxyAdmin = await ethers.getContractAt(
    "ProxyAdmin",
    proxyAdminAddress
  );

  const calldata = proxyAdmin.interface.encodeFunctionData("upgrade", [
    proxyAddress,
    newImplAddress,
  ]);

  console.log("Raw calldata for upgrade():", calldata);
}

main().catch((err) => {
  console.error("Error generating calldata:", err);
  process.exit(1);
});
