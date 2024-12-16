// const { artifacts, upgrades } = require("hardhat");
require("dotenv").config();
var adminDeploy = artifacts.require("../tron-contract/contracts/Admin")
var forwarderDeploy = artifacts.require("../tron-contract/contracts/Forwarder")
var cNGNDeploy = artifacts.require("../tron-contract/contracts/Cngn")

module.exports = async function(deployer) {
    console.log("Deploying Admin contract...");
    const admin = await deployer.deploy(adminDeploy);
    await admin.deployed();
    console.log("Admin contract deployed to:", admin.address);

    console.log("Deploying Forwarder contract...");
    const forwarder = deployer.deploy(forwarderDeploy, admin.address);
    await forwarder.deployed();
    console.log(
      "Forwarder contract deployed to:",
      forwarder.address
    );

    const cngnContract = await ethers.getContractFactory("Cngn")
    console.log("Deploying cngn contract...")
    const cngn = await deployer.deploy(
      cNGNDeploy,
      [forwarder.address, admin.address],
      {
        initializer: "initialize",
        kind: "transparent",
        unsafeAllow: ["delegatecall"],
      }
    );
  
    await cngn.deployed();
    console.log("Upgradeable cngn Contract deployed to:", cngn.address)

  // const a = deployer.deploy(cNGN)
  // console.log(a)
};
