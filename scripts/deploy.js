const { ethers, upgrades } = require("hardhat");

async function main() {
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
