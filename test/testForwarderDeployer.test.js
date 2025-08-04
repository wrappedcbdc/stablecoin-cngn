// scripts/testForwarder.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const forwarderAddress = "0x3E2Ca5355562C0BBdD208aDAC8915fe8B2095152";
  const forwarder = await ethers.getContractAt("Forwarder", forwarderAddress);

  console.log(`\n Forwarder connected at: ${forwarder.address}`);

  // 1. Test getNonce
  const nonce = await forwarder.getNonce(deployer.address);
  console.log(" getNonce:", nonce.toString());

  // 2. Test updateAdminOperationsAddress
  const newAdminAddress = "0x9B9b40d1810826e23C5CCd396Fca5B33382B14B2"; // Proxy address of Admin contract
  const tx1 = await forwarder.updateAdminOperationsAddress(newAdminAddress);
  await tx1.wait();
  console.log(" updateAdminOperationsAddress executed");

  // 3. Test authorizeBridge
  const bridge = "0x1234567890abcdef1234567890abcdef12345678";
  const tx2 = await forwarder.authorizeBridge(bridge);
  await tx2.wait();
  console.log(" authorizeBridge executed");

  // 4. Test deauthorizeBridge
  const tx3 = await forwarder.deauthorizeBridge(bridge);
  await tx3.wait();
  console.log(" deauthorizeBridge executed");

  // 5. Test pause
  const tx4 = await forwarder.pause();
  await tx4.wait();
  console.log(" pause executed");

  // 6. Test unpause
  const tx5 = await forwarder.unpause();
  await tx5.wait();
  console.log(" unpause executed");

  console.log("\n All owner-only tests completed successfully.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(" Test script failed:", error);
    process.exit(1);
  });
