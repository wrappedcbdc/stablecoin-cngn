const { ethers } = require("hardhat");

async function main() {
  const proxyAddress = "0x907E70221dc28bbFa8D5474C5e7425d9016298AD";

  //  Force Hardhat to use the correct ABI from CngnV2
  const cngn = await ethers.getContractAt(
    "contracts/cngn2.sol:CngnV2",
    proxyAddress
  );

  const admin = await cngn.adminOperationsContract();
  const forwarder = await cngn.isTrustedForwarder(
    "0x3E2Ca5355562C0BBdD208aDAC8915fe8B2095152"
  );

  console.log(" adminOperationsContract:", admin);
  console.log(" isTrustedForwarder (Biconomy?):", forwarder);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
