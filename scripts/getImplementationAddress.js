const { ethers, upgrades } = require("hardhat");

async function main() {
  const proxyAddress = "0x0eA85c7b02de31E33a88b32e53E9781F086f9cAC"; // Your proxy address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );
  console.log("Implementation Address:", implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
