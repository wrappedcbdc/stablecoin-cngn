import "dotenv/config";
import { createCNGNService } from "../cngn.js";

async function main() {
  const service = createCNGNService();

  // Either passed on command line or from env PROPOSAL_ID
  let proposalCid = process.argv[2] ?? process.env.PROPOSAL_ID;

  if (!proposalCid) {
    console.log("No proposal contract ID supplied. Searching for active MintProposals...");
    const proposals = await service.getMintProposals();
    if (!proposals.length) {
      console.log("No active mint proposals found on ledger.");
      return;
    }
    proposalCid = proposals[0].contractId;
    console.log(`Found active proposal: ${proposalCid}`);
    console.dir(proposals[0].payload, { depth: null });
  }

  console.log(`\nExecuting mint proposal on contract: ${proposalCid}...`);
  const result = await service.executeMint(proposalCid);

  console.log("Mint executed successfully!");
  console.dir(result, { depth: null });

  console.log("\nActive CNGN tokens:");
  const tokens = await service.getTokens();
  console.dir(tokens, { depth: null });
}

main().catch(console.error);
