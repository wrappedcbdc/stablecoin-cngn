require("dotenv").config();
const { deployProxy } = require('@openzeppelin/truffle-upgrades'); // Import OpenZeppelin upgrades library

const Admin = artifacts.require("Admin");
const Forwarder = artifacts.require("Forwarder");
const cNGN = artifacts.require("cNGN");

module.exports = async function (deployer) {
    console.log("Deploying Admin contract...");
    const admin = await deployProxy(Admin);
    console.log("Admin contract deployed to:", admin.address);

    console.log("Deploying Forwarder contract...");
    const forwarder = await deployer.deploy(Forwarder, admin.address);
    console.log("Forwarder contract deployed to:", forwarder.address);

    console.log("Deploying cNGN contract with proxy...");
    const cNGNProxy = await deployProxy(cNGN, [forwarder.address, admin.address], {
        deployer,
        initializer: "initialize", // Ensure your contract has an `initialize` function
    });
    console.log("cNGN Proxy deployed to:", cNGNProxy.address);
};
