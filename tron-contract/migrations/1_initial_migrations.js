const Migrations = artifacts.require("tron-contract/contracts/Migrations");

module.exports = function(deployer) {
  deployer.deploy(Migrations);
};
