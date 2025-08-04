// scripts/deployForwarder.js

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(` Deploying Forwarder with deployer EOA: ${deployer.address}...`);

  // AdminOperations contract (proxy address of ADMIN)
  const adminOperationsContract = "0x45cd4Db257788f213667020004F730014840eCC7";

  // Deploy Forwarder contract
  const Forwarder = await ethers.getContractFactory("Forwarder");
  const forwarder = await Forwarder.deploy(adminOperationsContract);
  await forwarder.deployed();

  console.log(` Forwarder deployed at: ${forwarder.address}`);

  // Transfer ownership to SAFE
  const SAFE = "0x262275de3Cd2da2a67BB6C569158A5559f17B953";
  console.log(` Transferring ownership to Safe: ${SAFE}`);

  const tx = await forwarder.transferOwnership(SAFE);
  await tx.wait();

  console.log(" Ownership of Forwarder successfully transferred to Safe.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(" Deployment failed:", error);
    process.exit(1);
  });
