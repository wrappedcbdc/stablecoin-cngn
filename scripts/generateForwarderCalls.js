const { ethers } = require("hardhat");

async function main() {
  const iface = new ethers.utils.Interface([
    "function updateAdminOperationsAddress(address newAdmin)",
    "function pause()",
    "function unpause()",
    "function authorizeBridge(address bridgeAddress)",
    "function deauthorizeBridge(address bridgeAddress)",
    "function getNonce(address from)",
    "function execute((address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data),bytes signature)",
  ]);

  const forwarderAddress = "0x19b2441868D516D9f72a1cb985c861b13e4B4371";

  const newAdmin = "0x9B9b40d1810826e23C5CCd396Fca5B33382B14B2";
  const bridge = "0x1234567890abcdef1234567890abcdef12345678";

  const updateAdminData = iface.encodeFunctionData(
    "updateAdminOperationsAddress",
    [newAdmin]
  );
  const pauseData = iface.encodeFunctionData("pause", []);
  const unpauseData = iface.encodeFunctionData("unpause", []);
  const authBridgeData = iface.encodeFunctionData("authorizeBridge", [bridge]);
  const deauthBridgeData = iface.encodeFunctionData("deauthorizeBridge", [
    bridge,
  ]);

  const forwardRequest = {
    from: bridge,
    to: bridge,
    value: 0,
    gas: 100000,
    nonce: 0,
    data: "0x",
  };
  const signature = "0x";
  const executeData = iface.encodeFunctionData("execute", [
    forwardRequest,
    signature,
  ]);

  console.log("\n Multisig Calls to Forwarder:", forwarderAddress);

  console.log("\n1️ updateAdminOperationsAddress:");
  console.log(updateAdminData);

  console.log("\n2️ pause:");
  console.log(pauseData);

  console.log("\n3️ unpause:");
  console.log(unpauseData);

  console.log("\n4️ authorizeBridge:");
  console.log(authBridgeData);

  console.log("\n5️ deauthorizeBridge:");
  console.log(deauthBridgeData);

  console.log("\n6️ execute (dummy data):");
  console.log(executeData);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
