const { ethers } = require("hardhat");

async function main() {
  const proxyAddress = "0xF22dc270F90535F5B10ceAc8da842c2b80cb8c51";
  const adminSlot =
    "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"; // EIP-1967 slot

  const raw = await ethers.provider.getStorageAt(proxyAddress, adminSlot);
  const admin = ethers.utils.getAddress("0x" + raw.slice(26));

  console.log(" Proxy admin is:", admin);
}

main().catch((error) => {
  console.error(" Error:", error);
  process.exit(1);
});
