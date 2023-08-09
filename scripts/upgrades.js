const { ethers, upgrades } = require("hardhat");

async function main() {

   const gas = await ethers.provider.getGasPrice();
   const cngn = await ethers.getContractFactory("cngn");
 
    console.log("Deploying cngn upgrafes contract...");
    const upgradeableCngn = await upgrades.upgradeProxy("0x2638d1e591c30A5E31df9E10E1b7DD6DD3eD8AfD", cngn,{
       kind: "transparent"
    });
    await upgradeableCngn.deployed();
    console.log("Upgradeable cngn deployed to:", upgradeableCngn.address);

}

main().catch((error) => {
   console.error(error);
   process.exitCode = 1;
 });