// scripts/deployCngn1Logic.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying CNGN1 logic contract from:", deployer.address);

  // Deploy logic contract
  const Cngn = await ethers.getContractFactory("Cngn");
  const cngnImpl = await Cngn.deploy();
  await cngnImpl.deployed();

  console.log(" CNGN1 Logic deployed at:", cngnImpl.address);

  // Call initialize on logic directly
  const trustedForwarder = "0xbc60d02EB5bD462d98C47385F2B2433f55166A8b";
  const adminOperationsProxy = "0x45cd4Db257788f213667020004F730014840eCC7";

  console.log(" Initializing logic contract with:");
  console.log("   → Trusted Forwarder:", trustedForwarder);
  console.log("   → Admin Operations:", adminOperationsProxy);

  const initTx = await cngnImpl.initialize(
    trustedForwarder,
    adminOperationsProxy
  );
  await initTx.wait();
  console.log(" Logic contract initialized.");

  // Transfer ownership to SAFE
  const SAFE = "0x262275de3Cd2da2a67BB6C569158A5559f17B953";
  console.log(" Transferring ownership to Safe:", SAFE);

  const tx = await cngnImpl.transferOwnership(SAFE);
  await tx.wait();

  console.log(" Ownership of CNGN1 logic transferred to Safe.");
}

main().catch((error) => {
  console.error(" Deployment failed:", error);
  process.exit(1);
});
