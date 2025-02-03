const { ethers, upgrades } = require("hardhat");

async function main() {
   // const proxyAddress = "0x1BE5EaCb5D503fe8D64c810a0b14cdD7eC48df1f" //polygon testnet
   // const proxyAddress = "0xA1A8892a746685FD8ae09FdCfAdce89fF6FB7234"; // eth testnet
   // const gas = await ethers.provider.getGasPrice();
   const cngn = await ethers.getContractFactory("Cngn");
 
    console.log("Deploying cngn upgrades contract...");
    const upgradeableCngn = await upgrades.upgradeProxy(proxyAddress, cngn,{
       kind: "transparent"
    });

    console.log("Upgradeable cngn deployed to:", upgradeableCngn.address);

}

main().catch((error) => {
   console.error(error);
   process.exitCode = 1;
 });