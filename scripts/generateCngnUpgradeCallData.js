// scripts/generateCngnUpgradeCallData.js
const { ethers } = require("hardhat");

async function main() {
  // Address of the ProxyAdmin contract
  const proxyAdminAddress = "0xA00DE410AC3ED7500556AE7FE6ea4bE8E41024fD";

  // Address of the CNGN1 proxy you want to upgrade
  const cngn1Proxy = "0xe41913b7c0071D6A9EED2fA01154D7d0694084E7";

  // Address of the newly deployed CNGN2 logic contract
  const cngn2Logic = "0xb6eDa5F3042a54fe87304586D15939AB7a62686A";

  // Define ABI for upgrade()
  const proxyAdminAbi = [
    "function upgrade(address proxy, address implementation) external",
  ];

  const iface = new ethers.utils.Interface(proxyAdminAbi);

  const calldata = iface.encodeFunctionData("upgrade", [
    cngn1Proxy,
    cngn2Logic,
  ]);

  console.log(" Call Data for upgrade(proxy, newImpl):\n", calldata);
  console.log(" To (recipient in MPCVault):", proxyAdminAddress);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
