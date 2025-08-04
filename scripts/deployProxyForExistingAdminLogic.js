// scripts/deployProxyForExistingAdminLogic.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const EXISTING_ADMIN_LOGIC = "0xF22dc270F90535F5B10ceAc8da842c2b80cb8c51";
  const PROXY_ADMIN = "0x77Ba270b3aBd79303f6E6593745e5b00df92d97c"; //  verified ProxyAdmin
  const SAFE_WALLET = "0x262275de3Cd2da2a67BB6C569158A5559f17B953";

  console.log("Using existing Admin logic at:", EXISTING_ADMIN_LOGIC);

  // Attach contract interface to existing logic
  const Admin = await ethers.getContractFactory("Admin");

  // Encode initializer data for initialize()
  const initData = Admin.interface.encodeFunctionData("initialize");

  // Deploy TransparentUpgradeableProxy with existing logic
  const TransparentUpgradeableProxy = await ethers.getContractFactory(
    "TransparentUpgradeableProxy"
  );

  const proxy = await TransparentUpgradeableProxy.deploy(
    EXISTING_ADMIN_LOGIC,
    PROXY_ADMIN,
    initData
  );

  await proxy.deployed();

  console.log(" Proxy deployed at:", proxy.address);
  console.log("→ Using logic at:", EXISTING_ADMIN_LOGIC);
  console.log("→ Managed by ProxyAdmin:", PROXY_ADMIN);
  console.log("→ Initialized with: Admin.initialize()");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
