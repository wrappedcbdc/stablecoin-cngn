const { ethers, upgrades, run } = require("hardhat");

async function main() {
   const gas = await ethers.provider.getGasPrice()

   // deplopy operations contract
   // const adminContract = await ethers.getContractFactory("Admin");
   // console.log("Deploying admin contract...");
   //  const admin = await upgrades.deployProxy(adminContract, []
   //    ,{
   //    initializer: "initialize",
   //    kind: "transparent",
   // }
   // )
   // await admin.deployed();
   // console.log("Upgradeable admin Contract deployed to:", admin.address);
   

   // deploy forwarder contract
   console.log("Deploying forwarder contract");
   const forwarderContract = await ethers.getContractFactory("MinimalForwarder");
   const forwarder = await forwarderContract.deploy("0x38bF0493a0623aC592EB652BBDF4A18c8e1C52E5");
   console.log("forwarder contract deployed to: ", forwarder.address);


   // deploy cngn contract
   // const cngnContract = await ethers.getContractFactory("cngn");
   // console.log("Deploying cngn contract...");
   //  const cngn = await upgrades.deployProxy(cngnContract, [
   //    forwarder.address,
   //    admin.address
   //  ]
   //    ,{
   //    initializer: "initialize",
   //    kind: "transparent",
   //    unsafeAllow: ['delegatecall']
   // }
   // )
   // await cngn.deployed();
   // console.log("Upgradeable cngn Contract deployed to:", cngn.address);

}

main().catch((error) => {
   console.error(error);
   process.exitCode = 1;
 });

