const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const SAFE_WALLET = "0x262275de3Cd2da2a67BB6C569158A5559f17B953";

  console.log("Deploying Admin2 logic from:", deployer.address);
  const Admin = await ethers.getContractFactory("Admin2");
  const admin2Impl = await Admin.deploy();
  await admin2Impl.deployed();
  console.log("Admin2 logic deployed at:", admin2Impl.address);

  // Give the chain a short delay (some networks are flaky)
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Step 1: Call initialize() to set deployer as owner
  console.log("Calling initialize() to set owner...");
  const txInit = await admin2Impl.initialize({ gasLimit: 300000 });
  await txInit.wait();
  console.log("Initialized logic contract");

  // Step 2: Transfer ownership to SAFE
  console.log("Transferring ownership to SAFE...");
  const txTransfer = await admin2Impl.transferOwnership(SAFE_WALLET);
  await txTransfer.wait();
  console.log("Ownership transferred to SAFE.");
}

main().catch((error) => {
  console.error("Error deploying Admin2 logic:", error);
  process.exit(1);
});
