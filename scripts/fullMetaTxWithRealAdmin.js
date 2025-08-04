// scripts/fullMetaTxWithRealAdmin.js
const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  const relayer = signer;
  const signerAddress = signer.address;
  const relayerAddress = relayer.address;

  // --- Update These ---
  const admin2Address = "0x9B9b40d1810826e23C5CCd396Fca5B33382B14B2"; // Admin2 proxy
  const forwarderAddress = "0x3E2Ca5355562C0BBdD208aDAC8915fe8B2095152"; // Forwarder
  const greeterAddress = "0x690DA120cCd65AC8191d685Eb0ADc9db24Ae268e"; // Greeter
  const newGreeting = "Hello from meta-tx!, test-running message via meta-txn";

  const Admin2 = await ethers.getContractAt("Admin2", admin2Address);
  const Forwarder = await ethers.getContractAt("Forwarder", forwarderAddress);

  console.log("Signer:", signerAddress);
  console.log("Relayer:", relayerAddress);

  // --- Initialize Admin2 ---
  try {
    await (await Admin2.connect(relayer).initialize()).wait();
    console.log(" Admin2 initialized");
  } catch (e) {
    if (e.message.includes("already initialized")) {
      console.log(" Admin2 already initialized");
    } else {
      console.warn(" Admin2 init error:", e.message);
    }
  }

  // --- Add signer to canForward ---
  const canForward = await Admin2.canForward(signerAddress);
  if (!canForward) {
    const tx1 = await Admin2.connect(relayer).addCanForward(signerAddress);
    await tx1.wait();
    console.log(" Signer added to canForward");
  } else {
    console.log(" Signer already in canForward");
  }

  // --- Remove from blacklist if needed ---
  const unblacklistIfNeeded = async (addr) => {
    const isBlacklisted = await Admin2.isBlackListed(addr);
    if (isBlacklisted) {
      const tx = await Admin2.connect(relayer).removeBlackList(addr);
      await tx.wait();
      console.log(` Removed ${addr} from blacklist`);
    }
  };

  await unblacklistIfNeeded(signerAddress);
  await unblacklistIfNeeded(relayerAddress);

  // --- Update Forwarder with correct Admin2 ---
  const tx2 = await Forwarder.connect(relayer).updateAdminOperationsAddress(
    admin2Address
  );
  await tx2.wait();
  console.log(" Forwarder updated with real Admin2");

  // --- Prepare MetaTx Call to Greeter ---
  const iface = new ethers.utils.Interface([
    "function setGreeting(string memory _greeting)",
  ]);
  const data = iface.encodeFunctionData("setGreeting", [newGreeting]);

  const nonce = await Forwarder.getNonce(signerAddress);
  console.log(" Nonce from chain:", nonce.toString());

  const request = {
    from: signerAddress,
    to: greeterAddress,
    value: 0,
    gas: 1_000_000,
    nonce: nonce.toNumber(),
    data,
  };

  const domain = {
    name: "cNGN",
    version: "0.0.1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: forwarderAddress,
  };

  const types = {
    ForwardRequest: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "gas", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
  };

  const signature = await signer._signTypedData(domain, types, request);

  // --- Verify Signature ---
  const digest = ethers.utils._TypedDataEncoder.hash(domain, types, request);
  const recovered = ethers.utils.recoverAddress(digest, signature);
  console.log(" Recovered signer from sig:", recovered);
  if (recovered.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(" Signature does not match signer address!");
  }

  // --- Execute MetaTx ---
  const tx3 = await Forwarder.connect(relayer).execute(request, signature);
  const receipt = await tx3.wait();
  console.log(" Meta-tx executed, tx hash:", receipt.transactionHash);

  // --- Read Result From Greeter ---
  const Greeter = await ethers.getContractAt(
    ["function greet() view returns (string memory)"],
    greeterAddress
  );
  const greeting = await Greeter.greet();
  console.log(" Greeter now says:", greeting);
}

main().catch((error) => {
  console.error(" Error in fullMetaTxWithRealAdmin:", error);
  process.exit(1);
});
