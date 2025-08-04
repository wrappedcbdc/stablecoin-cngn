require("dotenv").config();
const { ethers } = require("ethers");
const Safe = require("@safe-global/protocol-kit").default;
const EthersAdapter = require("@safe-global/safe-ethers-lib").default;

const safeAddress = "0x4C264aB777D102eF7DaF4b92894f3B32Af3DdbA5"; // Current Safe A
const newOwner = "0x262275de3Cd2da2a67BB6C569158A5559f17B953"; // New Safe B

const contractTargets = [
  "0xDE4E1627F5F9b80282547C6C59d697457C520D27", // Admin1 Logic
  "0x9ddcb800d7d8586d9a2B743606a8ADa7feaA94E2", // Admin2 Logic
  "0x7888a00Fa68421350ac6A9D9BfEEC75E9D81C5B5", // CNGN1 Logic
  "0xfDA9186e689B0c99005eF487947B581D1882499d", // CNGN2 Logic
  "0x94769710BD685C288552352ba81B85ee5250Bf70", // Forwarder
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

  // Load both owners
  const owner1 = new ethers.Wallet(process.env.PRIVATE_KEY1, provider);
  const owner2 = new ethers.Wallet(process.env.PRIVATE_KEY2, provider);

  // Create SDK instance with owner1 first
  const ethAdapter1 = new EthersAdapter({
    ethers,
    signerOrProvider: owner1,
  });
  const safeSdk1 = await Safe.create({ ethAdapter: ethAdapter1, safeAddress });

  // Encode ownership transfers
  const iface = new ethers.utils.Interface([
    "function transferOwnership(address newOwner)",
  ]);
  const safeTxs = contractTargets.map((target) => ({
    to: target,
    data: iface.encodeFunctionData("transferOwnership", [newOwner]),
    value: "0",
  }));

  // Create multisend transaction
  const safeTransaction = await safeSdk1.createTransaction({
    safeTransactionData: safeTxs,
  });

  const txHash = await safeSdk1.getTransactionHash(safeTransaction);
  console.log("Transaction Hash:", txHash);

  // Sign with Owner1
  await safeSdk1.signTransaction(safeTransaction);
  console.log("Signed by Owner 1 ");

  // Now create a second SDK for Owner2
  const ethAdapter2 = new EthersAdapter({
    ethers,
    signerOrProvider: owner2,
  });
  const safeSdk2 = await Safe.create({ ethAdapter: ethAdapter2, safeAddress });

  // Load same transaction and sign with Owner2
  await safeSdk2.signTransaction(safeTransaction);
  console.log("Signed by Owner 2 ");

  // Execute the transaction (only possible after all sigs are collected)
  const executeTx = await safeSdk2.executeTransaction(safeTransaction);
  const receipt = await executeTx.transactionResponse.wait();

  console.log(" Executed successfully in TX:", receipt.transactionHash);
}

main().catch((err) => {
  console.error(" Error:", err);
  process.exit(1);
});
