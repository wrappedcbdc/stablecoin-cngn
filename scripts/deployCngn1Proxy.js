const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying CNGN1 proxy from:", deployer.address);

  // Logic already deployed
  const implAddress = "0x975edC70A02B6A72a1a14C45ACE3d8b64577B665"; // Replace with actual logic address

  // Already deployed ProxyAdmin (controlled by MPCVault)
  const proxyAdmin = "0xA00DE410AC3ED7500556AE7FE6ea4bE8E41024fD";

  const Cngn = await ethers.getContractFactory("Cngn");

  // actual values
  const trustedForwarder = "0xbc60d02EB5bD462d98C47385F2B2433f55166A8b";
  const adminOperations = "0x45cd4Db257788f213667020004F730014840eCC7";

  const initData = Cngn.interface.encodeFunctionData("initialize", [
    trustedForwarder,
    adminOperations,
  ]);

  const TransparentUpgradeableProxy = await ethers.getContractFactory(
    "TransparentUpgradeableProxy"
  );

  const proxy = await TransparentUpgradeableProxy.deploy(
    implAddress,
    proxyAdmin,
    initData
  );

  await proxy.deployed();

  console.log(" CNGN1 Proxy deployed at:", proxy.address);
  console.log(" Linked to implementation at:", implAddress);
  console.log(" Controlled by ProxyAdmin:", proxyAdmin);
}

main().catch((error) => {
  console.error(" Proxy deployment failed:", error);
  process.exit(1);
});
