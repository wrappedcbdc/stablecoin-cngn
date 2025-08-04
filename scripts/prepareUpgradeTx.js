const { ethers } = require("hardhat");

async function main() {
  const proxyAdminAddress = "0x4EE39B6D61b1cab42FBFA0822806AdEe1Aa5c0Ca"; // ProxyAdmin
  const proxyAddress = "0x3cCfAEdA98041Ca5d542C9Ad03404f2191dF56e3"; // cNGN proxy
  const newImplAddress = "0xa1058B727cD7c740e90aEf7152f2Df1492050732"; // cNGN V2 logic

  const iface = new ethers.utils.Interface([
    "function upgrade(address proxy, address implementation)",
  ]);

  const calldata = iface.encodeFunctionData("upgrade", [
    proxyAddress,
    newImplAddress,
  ]);

  console.log("======== TX DETAILS ========");
  console.log("To:", proxyAdminAddress);
  console.log("Data:", calldata);
  console.log("Value:", 0);
  console.log("============================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
