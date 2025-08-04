const { ethers, upgrades } = require("hardhat");

async function main() {
  const proxy = "0x9B9b40d1810826e23C5CCd396Fca5B33382B14B2";
  const impl = await upgrades.erc1967.getImplementationAddress(proxy);
  console.log("Current implementation address:", impl);
}

main();
