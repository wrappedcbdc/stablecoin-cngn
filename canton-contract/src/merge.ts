import "dotenv/config";
import { createCNGNService } from "../cngn.js";

async function main() {
  const service = createCNGNService();
  const owner = process.env.OWNER ?? process.env.CNGN_ISSUER_PARTY;

  // If primaryCid and otherCids passed as arguments
  const primaryCid = process.argv[2];
  const otherCids = process.argv.slice(3);

  if (primaryCid && otherCids.length > 0) {
    console.log(`Merging ${otherCids.length} holding(s) into primary ${primaryCid}...`);
    const res = await service.mergeHoldings(primaryCid, otherCids);
    console.log("Merge completed!");
    console.dir(res, { depth: null });
    return;
  }

  // Automatic consolidation: query all unpaused holdings for owner and merge into the first one
  if (!owner) {
    console.log("Usage: npx tsx src/merge.ts <primaryCid> <otherCid1> [otherCid2 ...]");
    console.log("Or set OWNER in .env to auto-consolidate all holdings.");
    return;
  }

  console.log(`Auto-detecting holdings for owner ${owner}...`);
  const holdings = await service.getTokens(owner);
  const eligible = holdings.filter((h) => !h.payload.paused);

  if (eligible.length < 2) {
    console.log(`Found ${eligible.length} unpaused holding(s). Nothing to merge.`);
    return;
  }

  const primary = eligible[0].contractId;
  const others = eligible.slice(1).map((h) => h.contractId);

  console.log(`Merging ${others.length} holding(s) into primary ${primary}...`);
  const res = await service.mergeHoldings(primary, others);
  console.log("Consolidation completed!");
  console.dir(res, { depth: null });
}

main().catch(console.error);
