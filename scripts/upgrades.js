const { ethers, upgrades } = require("hardhat");

async function main() {

   const gas = await ethers.provider.getGasPrice();
   const cngn = await ethers.getContractFactory("cngn");
 
    console.log("Deploying cngn upgrades contract...");
    const upgradeableCngn = await upgrades.upgradeProxy("replace with proxy contract address", cngn,{

       kind: "transparent"
    });
    await upgradeableCngn.deployed();
    console.log("Upgradeable cngn deployed to:", upgradeableCngn.address);

}

main().catch((error) => {
   console.error(error);
   process.exitCode = 1;
 });