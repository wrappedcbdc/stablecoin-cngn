import "dotenv/config";
import { createCNGNService } from "../cngn.js";

async function main() {
  const service = createCNGNService();

  const command = process.argv[2] ?? "list";

  if (command === "list") {
    console.log("Listing active ForwardRequests...");
    const requests = await service.getForwardRequests();
    console.log(`Found ${requests.length} active ForwardRequest(s):`);
    console.dir(requests, { depth: null });
  } else if (command === "execute") {
    const forwardRequestCid = process.argv[3] ?? process.env.FORWARD_REQUEST_ID;
    if (!forwardRequestCid) {
      throw new Error("Usage: npx tsx src/forwarder.ts execute <forwardRequestCid>");
    }

    console.log(`Relayer executing ForwardRequest ${forwardRequestCid}...`);
    const res = await service.executeForward(forwardRequestCid);
    console.log("Forward execution successful! cNGN tokens minted via relayer.");
    console.dir(res, { depth: null });
  } else if (command === "reject") {
    const forwardRequestCid = process.argv[3] ?? process.env.FORWARD_REQUEST_ID;
    if (!forwardRequestCid) {
      throw new Error("Usage: npx tsx src/forwarder.ts reject <forwardRequestCid>");
    }

    console.log(`Rejecting ForwardRequest ${forwardRequestCid}...`);
    const res = await service.rejectForward(forwardRequestCid);
    console.log("ForwardRequest rejected.");
    console.dir(res, { depth: null });
  } else if (command === "nonce") {
    const minter = process.argv[3] ?? process.env.MINTER;
    if (!minter) throw new Error("Usage: npx tsx src/forwarder.ts nonce <minterParty>");

    const nonce = await service.getNonce(minter);
    console.log(`Current Nonce for minter ${minter}: ${nonce}`);
  } else {
    console.log("Available commands: list, execute <cid>, reject <cid>, nonce <minterParty>");
  }
}

main().catch(console.error);
