// scripts/checkProxyAdmin.js
const { ethers } = require("hardhat");

async function main() {
  const proxyAddress = "0xF22dc270F90535F5B10ceAc8da842c2b80cb8c51"; // Admin proxy
  // const proxyAddress = "0xdd3446ce5aA397Fd957460Ba03E4538Caeeff22e"; //ProxyAdmin contract
  const adminSlot =
    "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"; // EIP-1967 admin slot

  const admin = await ethers.provider.getStorageAt(proxyAddress, adminSlot);
  console.log(
    "Admin of proxy is:",
    ethers.utils.getAddress(`0x${admin.slice(26)}`)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
