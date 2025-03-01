const { ethers, upgrades } = require("hardhat");

async function main() {
   const proxyAddress = ""; // base original
   // const gas = await ethers.provider.getGasPrice();
   const cngn = await ethers.getContractFactory("Cngn");
   const [deployer] = await ethers.getSigners();
 
    console.log("Deploying cngn upgrades contract...");
    console.log("Deployer Address:", deployer.address);
    const upgradeableCngn = await upgrades.upgradeProxy(proxyAddress, cngn,{
       kind: "transparent"
    });

    console.log("Upgradeable cngn deployed to:", upgradeableCngn.address);

}

main().catch((error) => {
   console.error(error);
   process.exitCode = 1;
 });