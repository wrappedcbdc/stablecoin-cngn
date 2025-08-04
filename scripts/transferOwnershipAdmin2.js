// scripts/transferOwnershipAdmin2.js
const { ethers } = require("hardhat");

async function main() {
  const admin2Address = "0xc3a606016ba9E2C404d4C13007bdf413537DA815"; // your Admin2 logic address
  const safeWallet = "0x8BDB718D9E71E5Ab673Ef08860704Ed24F6D24FC"; // Safe wallet

  const [deployer] = await ethers.getSigners();
  console.log("Transferring ownership of Admin2 from:", deployer.address);

  const Admin2 = await ethers.getContractAt("Admin2", admin2Address);

  const tx = await Admin2.transferOwnership(safeWallet);
  console.log("Tx hash:", tx.hash);

  await tx.wait();
  console.log(" Ownership transferred to Safe:", safeWallet);
}

main().catch((err) => {
  console.error(" Error transferring ownership:", err);
  process.exit(1);
});
