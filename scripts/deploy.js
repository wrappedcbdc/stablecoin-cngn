const { ethers, upgrades, run } = require("hardhat");

async function main() {
   const gas = await ethers.provider.getGasPrice()
   const cngnContract = await ethers.getContractFactory("cngn");

   console.log("Deploying cngn contract...");
    const cngn = await upgrades.deployProxy(cngnContract, []
      ,{
      initializer: "initialize",
      kind: "transparent",
   }
   )
   await cngn.deployed();
   console.log("Upgradeable cngn Contract deployed to:", cngn.address);

}

main().catch((error) => {
   console.error(error);
   process.exitCode = 1;
 });

