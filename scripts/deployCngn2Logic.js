const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const SAFE_WALLET = "0x262275de3Cd2da2a67BB6C569158A5559f17B953";

  console.log("Deploying CNGN2 logic contract from:", deployer.address);

  const Cngn2 = await ethers.getContractFactory("Cngn2");
  const cngn2Impl = await Cngn2.deploy(); //  fixed line
  await cngn2Impl.deployed();

  console.log(" CNGN2 Logic deployed at:", cngn2Impl.address);

  // Params
  const trustedForwarder = "0xbc60d02EB5bD462d98C47385F2B2433f55166A8b";
  const adminOperations = "0x45cd4Db257788f213667020004F730014840eCC7";

  console.log(" Calling initialize() with:");
  console.log("   → Trusted Forwarder:", trustedForwarder);
  console.log("   → Admin Operations:", adminOperations);

  const initTx = await cngn2Impl.initialize(trustedForwarder, adminOperations);
  await initTx.wait();

  console.log(" Logic contract initialized.");

  console.log(" Transferring ownership to SAFE:", SAFE_WALLET);
  const transferTx = await cngn2Impl.transferOwnership(SAFE_WALLET);
  await transferTx.wait();

  console.log(" Ownership of CNGN2 logic transferred to SAFE.");
}

main().catch((error) => {
  console.error(" Error deploying CNGN2 logic:", error);
  process.exit(1);
});
