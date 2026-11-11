
import "dotenv/config";
import { createCNGNService } from "../cngn.js";

async function main() {
  const service = createCNGNService();

  const owner = process.env.OWNER ?? process.env.CNGN_ISSUER_PARTY;
  const minter = process.env.MINTER;

  const proposalId = process.env.PROPOSAL_ID;
  const amount = process.env.MINT_AMOUNT ?? "1000000";

  if (!owner || !minter || !proposalId) {
    throw new Error("OWNER, MINTER and PROPOSAL_ID are required");
  }

  const registries = await service.getMintRegistry(owner);

  if (!registries.length) {
    throw new Error("MintRegistry not found");
  }

  const registry = registries[0];

  if (!registry.payload.canMint.includes(minter)) {
    throw new Error("Minter is not authorized. Run AddCanMint first.");
  }

  console.log("Registering mint grant...");
  console.log({ owner, minter, proposalId, amount });

  const result = await service.addMintGrant(
    registry.contractId,
    minter,
    proposalId,
    amount
  );

  console.log("Mint grant registered successfully!");
  console.dir(result, { depth: null });
}

main().catch(console.error);
