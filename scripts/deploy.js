const { ethers, upgrades, run } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  //eth address
//  const admin = '0xd461A6d3CbCA4372eb3f82e66A4587CfeE700852'
//   const forwarder = '0xB9898Ec4Aa765f5D1dBC05b3B0cFEd1E51c4f302'

  // Deploy the Admin contract
  const Admin = await ethers.getContractFactory("Admin");
  console.log("Deploying Admin contract...");
  const admin = await upgrades.deployProxy(Admin);
  await admin.deployed();
  console.log("Admin contract deployed to:", admin.address);

  // Deploy the MinimalForwarder contract with the adminContract address
  const Forwarder = await ethers.getContractFactory("Forwarder");
  console.log("Deploying Forwarder contract...");
  const forwarder = await Forwarder.deploy(admin.address);
  await forwarder.deployed();
  console.log(
    "Forwarder contract deployed to:",
    forwarder.address
  );

  // Deploy the cngn contract via proxy
  const cngnContract = await ethers.getContractFactory("Cngn"); // Move this line before calling `deployProxy`
  console.log("Deploying cngn contract...");
  const cngn = await upgrades.deployProxy(
    cngnContract,
    [forwarder.address, admin.address],
    {
      initializer: "initialize",
      kind: "transparent",
      unsafeAllow: ["delegatecall"],
    }
  );

  await cngn.deployed();
  console.log("Upgradeable cngn Contract deployed to:", cngn.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
