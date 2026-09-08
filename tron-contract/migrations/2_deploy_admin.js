const Admin = artifacts.require("Admin");
const ProxyAdmin = artifacts.require("ProxyAdmin");
const TransparentUpgradeableProxy = artifacts.require("TransparentUpgradeableProxy");

module.exports = async function (deployer, network, accounts) {
  const deployerAddress = accounts;
  console.log("Deployer address:", deployerAddress);

  // Deploy ProxyAdmin
  await deployer.deploy(ProxyAdmin);
  const proxyAdmin = await ProxyAdmin.deployed();
  console.log("ProxyAdmin deployed to:", proxyAdmin.address);

  // Deploy Admin logic contract
  await deployer.deploy(Admin);
  const adminLogic = await Admin.deployed();
  console.log("Admin logic contract deployed to:", adminLogic.address);

  // Initialize data for the Admin contract - use hardcoded selector for parameterless initialize()
  const initializeData = "0x8129fc1c"; // Function selector for initialize()

  // Deploy only the TransparentUpgradeableProxy
  await deployer.deploy(
    TransparentUpgradeableProxy,
    adminLogicAddress,
    proxyAdminAddress,
    initializeData
  );

  const proxy = await TransparentUpgradeableProxy.deployed();
  console.log("Admin proxy deployed to:", proxy.address);

  // Create an instance of the Admin contract at the proxy address to verify it works
  const adminProxy = await Admin.at(proxy.address);
  console.log("Admin proxy is now ready for interaction at:", adminProxy.address);

  // Optional: Try to call a view function to verify the proxy is working correctly
  try {
    // Replace "owner" with an actual view function from your Admin contract
    const owner = await adminProxy.owner();
    console.log("Admin owner is:", owner);
    console.log("Note: Uncomment the verification code to test a specific function");
  } catch (error) {
    console.log("Could not verify proxy functionality. You may need to check manually.");
  }
}


// Using Admin Operations contract at: 414cd899eb21837b0f53da56dc1b80d9bac55daa20
//   Deploying Forwarder...
//   Forwarder:
//     (base58) TXQbCr64i7pgdeqn6XJ2656LXdybwPwdUk
//     (hex) 41eb279328a1c6efa9f1d8d3eb757138df13d2079c
// Forwarder contract deployed to:
//   (base58): 41eb279328a1c6efa9f1d8d3eb757138df13d2079c
//   (hex): eb279328a1c6efa9f1d8d3eb757138df13d2079c
// Forwarder owner: 41e374d2de409bdb480d9709defc9af6f65324db3f
// Owner matches deployer: ✗ NO
// Contract chain ID: 3448148188
// Admin operations contract: 414cd899eb21837b0f53da56dc1b80d9bac55daa20
// Admin address matches expected: ✓ YES
// Domain separator: 0xaac04f088df65ccef89fe5d9237961d73de7f0d87067e7c34084c9f90dfe72c1
// Deployment completed successfully!