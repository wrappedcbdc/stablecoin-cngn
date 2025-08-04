const { ethers } = require("ethers");

const newSafe = "0x262275de3Cd2da2a67BB6C569158A5559f17B953";

const targets = {
  "Admin1 Logic": "0xDE4E1627F5F9b80282547C6C59d697457C520D27",
  "Admin2 Logic": "0x9ddcb800d7d8586d9a2B743606a8ADa7feaA94E2",
  "CNGN1 Logic": "0x7888a00Fa68421350ac6A9D9BfEEC75E9D81C5B5",
  "CNGN2 Logic": "0xfDA9186e689B0c99005eF487947B581D1882499d",
  Forwarder: "0x94769710BD685C288552352ba81B85ee5250Bf70",
};

const iface = new ethers.utils.Interface([
  "function transferOwnership(address newOwner)",
]);

for (const [label, address] of Object.entries(targets)) {
  const data = iface.encodeFunctionData("transferOwnership", [newSafe]);
  console.log(`${label}:\n To: ${address}\n Data: ${data}\n`);
}
