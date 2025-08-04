// scripts/getUpgradeCalldataAdmin.js
const { ethers } = require("hardhat");

async function main() {
  const proxyAdmin = await ethers.getContractAt(
    "ProxyAdmin",
    "0xA00DE410AC3ED7500556AE7FE6ea4bE8E41024fD"
  );

  const calldata = proxyAdmin.interface.encodeFunctionData("upgrade", [
    "0x45cd4Db257788f213667020004F730014840eCC7", // proxy
    "0xd4aF428A7a47Fb3e6cEf14030f88eB0832A97120", // new implementation
  ]);

  console.log("Raw calldata for upgrade():", calldata);
}

main();
