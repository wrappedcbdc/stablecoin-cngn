const { ethers, upgrades, run } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Corrected: Use ethers.providers.JsonRpcProvider
  const provider = new ethers.providers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/PvbeyL6n-V9RJeoFJouD_wrr1uX_cg_e"
  );
  provider.hasENS = () => false; // Disable ENS features in the provider

  // Address gotten after testnet deployment, we will need it for verification, same process for mainnet
  // const adminContractAddress = "0x11132f1e1786d8918E69cEAB1d4d7D26A1a25cD2";
  // const trustedForwarderContract = "0x041b518B83AcF6f0a3AfD03afe448C16C84CaADe";

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
  const cngnContract = await ethers.getContractFactory("cngn"); // Move this line before calling `deployProxy`
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
