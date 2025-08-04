const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    " Deploying CngnV2 logic contract with deployer:",
    deployer.address
  );

  const CngnV2 = await ethers.getContractFactory("CngnV2");
  const cngnV2Impl = await CngnV2.deploy();

  await cngnV2Impl.deployed();
  console.log(" CngnV2 logic contract deployed at:", cngnV2Impl.address);
}

main().catch((error) => {
  console.error(" Deployment failed:", error);
  process.exit(1);
});
