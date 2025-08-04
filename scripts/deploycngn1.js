const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying Cngn logic and manual proxy with deployer:",
    deployer.address
  );

  // Deploy the implementation (logic) contract
  const Cngn = await ethers.getContractFactory("Cngn");
  const cngnImpl = await Cngn.deploy();
  await cngnImpl.deployed();
  const implAddress = cngnImpl.address;
  console.log("Cngn Logic deployed at:", implAddress);

  // Use the same ProxyAdmin as Admin1
  const proxyAdmin = "0xD69ca90Ee6ac3DD2a8CD4C37E5F6bde2C9e3884F";

  // Prepare the encoded initialize() data with the right parameters
  const trustedForwarder = "0x3E2Ca5355562C0BBdD208aDAC8915fe8B2095152"; // replace with actual address
  const adminOperations = "0x9B9b40d1810826e23C5CCd396Fca5B33382B14B2"; // replace with actual Admin2 proxy address

  const initData = Cngn.interface.encodeFunctionData("initialize", [
    trustedForwarder,
    adminOperations,
  ]);

  // Deploy TransparentUpgradeableProxy
  const TransparentUpgradeableProxy = await ethers.getContractFactory(
    "TransparentUpgradeableProxy"
  );
  const proxy = await TransparentUpgradeableProxy.deploy(
    implAddress,
    proxyAdmin,
    initData
  );
  await proxy.deployed();

  const proxyAddress = proxy.address;

  console.log(" Cngn Proxy deployed at:", proxyAddress);
  console.log(" Linked to implementation at:", implAddress);
  console.log(" Controlled by ProxyAdmin:", proxyAdmin);
}

main().catch((err) => {
  console.error(" Deployment error:", err);
  process.exit(1);
});
