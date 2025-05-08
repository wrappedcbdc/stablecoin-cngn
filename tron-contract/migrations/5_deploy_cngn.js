const Cngn = artifacts.require("Cngn");
const TransparentUpgradeableProxy = artifacts.require("TransparentUpgradeableProxy");
const ProxyAdmin = artifacts.require("ProxyAdmin");

module.exports = async function (deployer, network, accounts) {
  const deployerAddress = accounts;
  console.log("Deployer address:", deployerAddress);
  
  // Admin proxy address from the previous deployment - TRON format
  const adminOperationsAddress = "414cd899eb21837b0f53da56dc1b80d9bac55daa20"; 
  console.log("Using Admin Operations contract at:", adminOperationsAddress);
  
  // Forwarder proxy address from the previous deployment - TRON format
  const forwarderProxyAddress = "41eb279328a1c6efa9f1d8d3eb757138df13d2079c";
  console.log("Using Forwarder contract at:", forwarderProxyAddress);
  
  // Use existing ProxyAdmin
  const existingProxyAdminAddress = "4108e8bd7f06fa9ee5603cd8ddf48827be875ee77e";
  console.log("Using existing ProxyAdmin at:", existingProxyAdminAddress);
  const proxyAdmin = await ProxyAdmin.at(existingProxyAdminAddress);
  
  // Deploy Cngn logic contract
  await deployer.deploy(Cngn);
  const cngnLogic = await Cngn.deployed();
  console.log("Cngn logic contract deployed to:", cngnLogic.address);
  
  // Handle initialization data using a simpler approach
  // This is the function selector for initialize(address,address)
  // initialize(address,address) -> 0x485cc955
  const functionSelector = "0x485cc955";
  
  // Prepare parameters - addresses need to be properly formatted
  // Remove '41' prefix if present and pad to 32 bytes (64 hex chars)
  const encodedForwarder = forwarderProxyAddress.startsWith("41") ? 
    "000000000000000000000000" + forwarderProxyAddress.substring(2) : 
    "000000000000000000000000" + forwarderProxyAddress;
    
  const encodedAdmin = adminOperationsAddress.startsWith("41") ? 
    "000000000000000000000000" + adminOperationsAddress.substring(2) : 
    "000000000000000000000000" + adminOperationsAddress;
  
  // Combine function selector and parameters
  const initializeData = functionSelector + encodedForwarder + encodedAdmin;
  console.log("Using manual initialization data:", initializeData);
  
  // Deploy TransparentUpgradeableProxy
  await deployer.deploy(
    TransparentUpgradeableProxy,
    cngnLogic.address,
    proxyAdmin.address,
    initializeData
  );
  
  const proxy = await TransparentUpgradeableProxy.deployed();
  console.log("Cngn proxy deployed to:", proxy.address);
  
  try {
    // Create an instance of the Cngn contract at the proxy address for verification
    const cngnProxy = await Cngn.at(proxy.address);
    console.log("Proxy initialized with admin operations at:", await cngnProxy.adminOperationsContract());
    console.log("Proxy initialized with trusted forwarder at:", await cngnProxy.trustedForwarderContract());
  } catch (error) {
    console.log("Note: Verification step failed but proxy deployment should be complete. Error:", error.message);
  }
};