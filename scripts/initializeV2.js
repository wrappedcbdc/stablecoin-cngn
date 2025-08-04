const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0];

  console.log("Using signer:", signer.address);

  const cngn = await ethers.getContractAt(
    "CngnV2",
    "0x907E70221dc28bbFa8D5474C5e7425d9016298AD"
  );

  const admin = "0x9B9b40d1810826e23C5CCd396Fca5B33382B14B2"; // update this
  const forwarder = "0x3E2Ca5355562C0BBdD208aDAC8915fe8B2095152"; // update this

  const tx = await cngn.initialize(admin, forwarder);
  console.log("initialize() tx hash:", tx.hash);

  await tx.wait();
  console.log(" CngnV2 initialized.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
