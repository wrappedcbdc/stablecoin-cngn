const Admin = artifacts.require("Admin");
const ProxyAdmin = artifacts.require("ProxyAdmin");
const TransparentUpgradeableProxy = artifacts.require("TransparentUpgradeableProxy");

module.exports = async function (deployer, network, accounts) {
  // Reference the previously deployed contracts by address
  const adminLogicAddress = "4152ff3a9ccc6e15487e655ac75d392aa574da826c"; // Your Admin logic contract address
  const proxyAdminAddress = "4108e8bd7f06fa9ee5603cd8ddf48827be875ee77e"; // Your ProxyAdmin contract address

  console.log("Continuing deployment with:");
  console.log("Admin logic address:", adminLogicAddress);
  console.log("ProxyAdmin address:", proxyAdminAddress);

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
};

// Deployer address: TWhtLf6us1DhfYJ5DSckdYUJa9dRH1zZ2g
// Using Admin Operations contract at: 414cd899eb21837b0f53da56dc1b80d9bac55daa20
// Using Forwarder contract at: 41eb279328a1c6efa9f1d8d3eb757138df13d2079c
// Using existing ProxyAdmin at: 4108e8bd7f06fa9ee5603cd8ddf48827be875ee77e
//   Deploying Cngn...
//   Cngn:
//     (base58) TWc9NTBNeXmmVrQ8hXVtznagzWeaFFiE1q
//     (hex) 41e25ee0086dae3d7a09cfa2dd97de8dbffc3b27d5
// Cngn logic contract deployed to: 41e25ee0086dae3d7a09cfa2dd97de8dbffc3b27d5
// Using manual initialization data: 0x485cc955000000000000000000000000eb279328a1c6efa9f1d8d3eb757138df13d2079c0000000000000000000000004cd899eb21837b0f53da56dc1b80d9bac55daa20
//   Replacing TransparentUpgradeableProxy...
//   TransparentUpgradeableProxy:
//     (base58) TDZYyiypTFNQKStwCsW3j8fbDAdcDMyvAf
//     (hex) 412767322d778d0d3096e035c926e7ba416647fb1c
// Cngn proxy deployed to: 412767322d778d0d3096e035c926e7ba416647fb1c
// Proxy initialized with admin operations at: 414cd899eb21837b0f53da56dc1b80d9bac55daa20
// Proxy initialized with trusted forwarder at: 41eb279328a1c6efa9f1d8d3eb757138df13d2079c