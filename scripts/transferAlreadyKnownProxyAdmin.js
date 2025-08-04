const { ethers } = require("hardhat");

async function main() {
  // Use the known ProxyAdmin address
  const PROXY_ADMIN_ADDRESS = "0xdeD775427dCBbE3EF8C008926d5C3111A25e9938";

  // New owner (MPCVault multisig address)
  const NEW_OWNER = "0x2099C4351Cd91EF616Da9e874E1ef8944e29721a";

  const [deployer] = await ethers.getSigners();
  console.log("Using signer:", deployer.address);

  // Attach to the already deployed ProxyAdmin contract
  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  const proxyAdmin = await ProxyAdmin.attach(PROXY_ADMIN_ADDRESS);

  // Confirm current owner (for sanity check)
  const currentOwner = await proxyAdmin.owner();
  console.log("Current ProxyAdmin owner:", currentOwner);

  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Signer is not the current owner of ProxyAdmin.");
  }

  // Transfer ownership
  console.log(`Transferring ProxyAdmin ownership to: ${NEW_OWNER}...`);
  const tx = await proxyAdmin.transferOwnership(NEW_OWNER);
  await tx.wait();

  console.log(" Ownership successfully transferred.");
}

main().catch((error) => {
  console.error(" Error:", error);
  process.exit(1);
});
