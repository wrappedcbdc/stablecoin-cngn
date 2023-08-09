var MyContract = artifacts.require("cngn");

module.exports = function(deployer) {
  const a = deployer.deploy(MyContract);
  console.log(a)
};
