const { ethers } = require("hardhat");

async function main() {
  const proxyAdmin = await ethers.getContractAt(
    "ProxyAdmin",
    "0xD69ca90Ee6ac3DD2a8CD4C37E5F6bde2C9e3884F"
  );

  const tx = await proxyAdmin.transferOwnership(
    "0x8BDB718D9E71E5Ab673Ef08860704Ed24F6D24FC"
  );
  console.log(" Ownership transfer tx:", tx.hash);
  await tx.wait();
  console.log(" ProxyAdmin now controlled by Safe");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
