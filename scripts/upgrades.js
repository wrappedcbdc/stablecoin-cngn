const { ethers, upgrades } = require("hardhat");

async function main() {
   const proxyAddress = "0x1BE5EaCb5D503fe8D64c810a0b14cdD7eC48df1f"; // your proxy address
   const cngn = await ethers.getContractFactory("Cngn");
   const [deployer] = await ethers.getSigners();
 
   console.log("Deployer Address:", deployer.address);

   // First, force import the proxy
   console.log("Importing proxy...");
  //  await upgrades.forceImport(proxyAddress, cngn, { kind: "transparent" });
   
   // Now you can upgrade
   console.log("Deploying cngn upgrades contract...");
   const upgradeableCngn = await upgrades.upgradeProxy(proxyAddress, cngn, {
      kind: "transparent"
   });

   console.log("Upgradeable cngn deployed to:", upgradeableCngn.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });