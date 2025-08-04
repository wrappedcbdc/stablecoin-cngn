const { ethers } = require("ethers");
require("dotenv").config();

const contracts = [
  { name: "CNGN", address: "0x7E29CF1D8b1F4c847D0f821b79dDF6E67A5c11F8" },
  { name: "Admin", address: "0xF22dc270F90535F5B10ceAc8da842c2b80cb8c51" },
  { name: "Forwarder", address: "0x779Fd76F984fbcef99cEd26538008f843503ab6e" },
];

const eip1967ImplementationSlot =
  "0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC"; // keccak-256("eip1967.proxy.implementation") - 1
const eip1967AdminSlot =
  "0xb53127684a568b3173ae13b9f8a6016e01ff55a0" + "000000000000000000000000"; // first 20 bytes will give admin

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

  for (const { name, address } of contracts) {
    const impl = await provider.getStorageAt(
      address,
      eip1967ImplementationSlot
    );
    const admin = await provider.getStorageAt(address, eip1967AdminSlot);

    const implAddress = "0x" + impl.slice(26);
    const adminAddress = "0x" + admin.slice(26);

    const isProxy =
      impl !==
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    console.log(`\n ${name} Contract: ${address}`);
    console.log(`→ Is Proxy: ${isProxy}`);
    if (isProxy) {
      console.log(`→ Implementation (Logic): ${implAddress}`);
      console.log(`→ Admin (ProxyAdmin): ${adminAddress}`);
    } else {
      console.log(`→ Seems like a Logic or Direct Contract`);
    }
  }
}

main();
