// scripts/checkOwner.js
const { ethers } = require("hardhat");

async function main() {
  const Admin = await ethers.getContractFactory("Admin");
  const adminImpl = Admin.attach("0x909ca8a8d139fC75Ce19Ed9a747bfde7649a9d1e");

  const owner = await adminImpl.owner();
  console.log("Current owner of Admin proxy:", owner);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
