// scripts/deploy-safe-contracts.js

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  const contracts = {};

  // Deploy Safe (Gnosis Safe singleton)
  const Safe = await hre.ethers.getContractFactory("Safe");
  const safeMasterCopy = await Safe.deploy();
  await safeMasterCopy.deployed();
  contracts.safeMasterCopyAddress = safeMasterCopy.address;
  console.log("✅ Safe Master Copy:", safeMasterCopy.address);

  // Deploy Proxy Factory
  const ProxyFactory = await hre.ethers.getContractFactory("SafeProxyFactory");
  const proxyFactory = await ProxyFactory.deploy();
  await proxyFactory.deployed();
  contracts.safeProxyFactoryAddress = proxyFactory.address;
  console.log("✅ Safe Proxy Factory:", proxyFactory.address);

  // Deploy Fallback Handler
  const FallbackHandler = await hre.ethers.getContractFactory("CompatibilityFallbackHandler");
  const fallbackHandler = await FallbackHandler.deploy();
  await fallbackHandler.deployed();
  contracts.fallbackHandlerAddress = fallbackHandler.address;
  console.log("✅ Fallback Handler:", fallbackHandler.address);

  // Deploy MultiSend
  const MultiSend = await hre.ethers.getContractFactory("MultiSend");
  const multiSend = await MultiSend.deploy();
  await multiSend.deployed();
  contracts.multiSendAddress = multiSend.address;
  console.log("✅ MultiSend:", multiSend.address);

  // Deploy MultiSendCallOnly
  const MultiSendCallOnly = await hre.ethers.getContractFactory("MultiSendCallOnly");
  const multiSendCallOnly = await MultiSendCallOnly.deploy();
  await multiSendCallOnly.deployed();
  contracts.multiSendCallOnlyAddress = multiSendCallOnly.address;
  console.log("✅ MultiSendCallOnly:", multiSendCallOnly.address);

  // Deploy SignMessageLib
  const SignMessageLib = await hre.ethers.getContractFactory("SignMessageLib");
  const signMessageLib = await SignMessageLib.deploy();
  await signMessageLib.deployed();
  contracts.signMessageLibAddress = signMessageLib.address;
  console.log("✅ SignMessageLib:", signMessageLib.address);

  // Deploy CreateCall
  const CreateCall = await hre.ethers.getContractFactory("CreateCall");
  const createCall = await CreateCall.deploy();
  await createCall.deployed();
  contracts.createCallAddress = createCall.address;
  console.log("✅ CreateCall:", createCall.address);

  // Write all addresses to a JSON file for re-use
  const outputPath = path.join(__dirname, "../safe-contracts.json");
  fs.writeFileSync(outputPath, JSON.stringify(contracts, null, 2));
  console.log("\n💾 All deployed contract addresses saved to safe-contracts.json\n");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
