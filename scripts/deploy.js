const { ethers, upgrades } = require("hardhat");

async function main() {
  // Deploy the Admin contract
  const [deployer] = await ethers.getSigners();
  const Admin = await ethers.getContractFactory("Admin");

  console.log("Deploying Admin contract...");
  const admin = await upgrades.deployProxy(Admin, [], {
    initializer: "initialize",
    kind: "transparent",
    admin: deployer.address
  });
  await admin.deployed();
  console.log("Admin contract deployed to:", admin.address);


  // Automatically verify the Admin proxy implementation
  const adminImplementationAddress = await upgrades.erc1967.getImplementationAddress(admin.address);
  console.log("Admin Implementation address:", adminImplementationAddress);

  await hre.run("verify:verify", {
    address: adminImplementationAddress,
  });

  // Deploy the Forwarder contract with the adminContract address
  const Forwarder = await ethers.getContractFactory("Forwarder");
  console.log("Deploying Forwarder contract...");
  const forwarder = await Forwarder.deploy(admin.address);
  await forwarder.deployed();
  console.log(
    "Forwarder contract deployed to:",
    forwarder.address
  );

  await hre.run("verify:verify", {
      address: forwarder.address,
      constructorArguments: [admin.address]
    });

  // Deploy the cngn contract via proxy
  const cngnContract = await ethers.getContractFactory("Cngn"); // Move this line before calling `deployProxy`
  console.log("Deploying cngn contract...");
  const cngn = await upgrades.deployProxy(
    cngnContract,
    [forwarder.address, admin.address],
    {
      initializer: "initialize",
      kind: "transparent",
      // unsafeAllow: ["delegatecall"],
    }
  );

  await cngn.deployed();
  console.log("Upgradeable cngn Contract deployed to:", cngn.address);

    // Automatically verify the Admin proxy implementation
    const cngnImplementationAddress = await upgrades.erc1967.getImplementationAddress(admin.address);
    console.log("cNGN Implementation address:", cngnImplementationAddress);
  await hre.run("verify:verify", {
      address: cngnImplementationAddress,
      constructorArguments: [forwarder.address,admin.address], 
    });

      // Add Cngn2 as a trusted contract in Admin2
  console.log("Adding Cngn2 as a trusted contract in Admin2...");
  const addTrustedTx = await admin.addTrustedContract(cngn2.address);
  await addTrustedTx.wait();
  console.log("Cngn2 added as trusted contract in Admin2");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
