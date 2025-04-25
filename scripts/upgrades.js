const { ethers, upgrades } = require("hardhat");

async function main() {
   const proxyAddress = "0xF22dc270F90535F5B10ceAc8da842c2b80cb8c51"; // your proxy address
   const cngn = await ethers.getContractFactory("Admin");
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