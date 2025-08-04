// scripts/testCngnV2Upgrade.js
const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();

  const proxyAddress = "0x907E70221dc28bbFa8D5474C5e7425d9016298AD";
  const cngn = await ethers.getContractAt("CngnV2", proxyAddress);

  console.log("Using signer:", signer.address);

  const decimals = await cngn.decimals();
  console.log("Decimals:", decimals.toString());

  // Optional: Check balance
  const balance = await cngn.balanceOf(signer.address);
  console.log(
    "Your current balance:",
    ethers.utils.formatUnits(balance, decimals)
  );

  //  Transfer test: transfer to self (or another known address)
  const tx = await cngn.transfer(signer.address, 0); // safe no-op
  await tx.wait();
  console.log(" Transfer executed");

  // ❗ Optional: Mint test (only if signer is allowed by Admin)
  // const mintTx = await cngn.mint(ethers.utils.parseUnits("100", decimals), signer.address);
  // await mintTx.wait();
  // console.log(" Minted 100 tokens");

  // Check again
  const updatedBalance = await cngn.balanceOf(signer.address);
  console.log(
    "Updated balance:",
    ethers.utils.formatUnits(updatedBalance, decimals)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
