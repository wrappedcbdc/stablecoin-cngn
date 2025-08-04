// scripts/deployAdmin1Proxy.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Admin1 proxy from:", deployer.address);

  //  deployed Admin1 logic address here:
  const implAddress = "0x671c294598D1Dc51debDDA11df0001b0Abed12d4";

  // ProxyAdmin already deployed and owned by MPCVault
  const proxyAdmin = "0x68A1C4183871f8c63a9a81aA51Ec5ad84750fEa3";

  const Admin = await ethers.getContractFactory("Admin");
  const initData = Admin.interface.encodeFunctionData("initialize");

  const TransparentUpgradeableProxy = await ethers.getContractFactory(
    "TransparentUpgradeableProxy"
  );
  const proxy = await TransparentUpgradeableProxy.deploy(
    implAddress,
    proxyAdmin,
    initData
  );

  await proxy.deployed();

  console.log(" Admin1 Proxy deployed at:", proxy.address);
  console.log(" Linked to implementation at:", implAddress);
  console.log(" Controlled by ProxyAdmin:", proxyAdmin);
}

main().catch((error) => {
  console.error(" Proxy deployment failed:", error);
  process.exit(1);
});
