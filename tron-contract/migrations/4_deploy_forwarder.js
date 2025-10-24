const Forwarder = artifacts.require("Forwarder");

module.exports = async function (deployer, network, accounts) {
  const deployerAddress = accounts;
  console.log("Deployer address:", deployerAddress);

  
  //Admin proxy address from the previous deployment
  const adminProxyAddress = "414cd899eb21837b0f53da56dc1b80d9bac55daa20"; // Update this!
  console.log("Using Admin Operations contract at:", adminProxyAddress);

  // Deploy Forwarder contract with the Admin contract address as parameter
  await deployer.deploy(Forwarder, adminProxyAddress);
  const forwarder = await Forwarder.deployed();
  
  console.log("Forwarder contract deployed to:");
  console.log("  (base58):", forwarder.address);
  console.log("  (hex):", forwarder.address.substring(2));
  
  // Verify contract owner
  const owner = await forwarder.owner();
  console.log("Forwarder owner:", owner);
  console.log("Owner matches deployer:", owner === deployerAddress ? "✓ YES" : "✗ NO");
  
  // Verify chain ID
  const chainId = await forwarder.getChainId();
  console.log("Contract chain ID:", chainId.toString());
  
  // Verify admin operations contract
  const adminOpsAddress = await forwarder.adminOperationsContract();
  console.log("Admin operations contract:", adminOpsAddress);
  console.log("Admin address matches expected:", adminOpsAddress === adminProxyAddress ? "✓ YES" : "✗ NO");
  
  // Verify domain separator
  const domainSeparator = await forwarder.getDomainSeparator();
  console.log("Domain separator:", domainSeparator);
  
  console.log("Deployment completed successfully!");
};