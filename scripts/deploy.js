const { ethers, upgrades, run } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // address gotten after tesnet deployment, we will need it for verification, same process for maiinet
  const minimalForwarderAddress = "0x397551C510FBEae4908EdA2262F11761660E30e9";
  const adminContractAddress = "0xAF8d581E4eEAF9087a2302FF2fc524591d72c89d ";

  // Deploy the MinimalForwarder contract with the adminContract address
  const MinimalForwarder = await ethers.getContractFactory("MinimalForwarder");
  console.log("Deploying MinimalForwarder contract...");
  const minimalForwarder = await MinimalForwarder.deploy(adminContractAddress);
  await minimalForwarder.deployed();
  console.log(
    "MinimalForwarder contract deployed to:",
    minimalForwarder.address
  );

  // Deploy the Admin contract
  const Admin = await ethers.getContractFactory("Admin");
  console.log("Deploying Admin contract...");
  const admin = await Admin.deploy();
  await admin.deployed();
  console.log("Admin contract deployed to:", admin.address);

  // Deploy the cngn contract via proxy
  const cngnContract = await ethers.getContractFactory("cngn");
  console.log("Deploying cngn contract...");
  const cngn = await upgrades.deployProxy(
    cngnContract,
    [minimalForwarder.address, admin.address],
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
