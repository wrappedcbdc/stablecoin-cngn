const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const Greeter = await ethers.getContractFactory("Greeter");
  const greeter = await Greeter.deploy();
  await greeter.deployed();
  console.log("Greeter deployed at:", greeter.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
