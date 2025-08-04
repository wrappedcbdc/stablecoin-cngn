const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Admin1 logic contract from:", deployer.address);

  const Admin = await ethers.getContractFactory("Admin");
  const adminImpl = await Admin.deploy();
  await adminImpl.deployed();

  console.log(" Admin1 Logic deployed at:", adminImpl.address);

  console.log(" Calling initialize()...");
  const initTx = await adminImpl.initialize();
  await initTx.wait();

  // SAFE wallet to receive ownership
  const SAFE_WALLET = "0x262275de3Cd2da2a67BB6C569158A5559f17B953";

  console.log(" Transferring ownership to Safe:", SAFE_WALLET);
  const tx = await adminImpl.transferOwnership(SAFE_WALLET);
  await tx.wait();

  console.log(" Ownership of Admin1 logic transferred to Safe.");
}

main().catch((error) => {
  console.error(" Deployment failed:", error);
  process.exit(1);
});
