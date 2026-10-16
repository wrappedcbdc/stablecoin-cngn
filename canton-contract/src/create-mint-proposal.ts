import "dotenv/config";
import { createCNGNService } from "../cngn.js";

async function main() {
  const service = createCNGNService();

  const owner = process.env.OWNER ?? process.env.CNGN_ISSUER_PARTY;
  const minter = process.env.MINTER;
  const mintTo = process.env.MINT_TO ?? owner;
  const amount = process.env.MINT_AMOUNT ?? "1000000"; // 1 cNGN default (6 decimals)
  const proposalId = process.env.PROPOSAL_NAME ?? `proposal-${Date.now()}`;

  if (!owner || !minter || !mintTo) {
    throw new Error("OWNER, MINTER, and MINT_TO must be configured in environment or arguments.");
  }

  console.log("=== Creating cNGN Mint Proposal ===");
  console.log(`Issuer:   ${owner}`);
  console.log(`Minter:   ${minter}`);
  console.log(`MintTo:   ${mintTo}`);
  console.log(`Amount:   ${amount} units`);
  console.log(`Proposal: ${proposalId}`);

  const result = await service.createMintProposal({
    issuer: owner,
    minter,
    mintTo,
    amount,
    proposalId,
  });

  console.log("\nMint proposal created successfully!");
  console.dir(result, { depth: null });
}

main().catch(console.error);