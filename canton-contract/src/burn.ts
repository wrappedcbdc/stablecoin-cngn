import "dotenv/config";
import { createCNGNService } from "../cngn.js";

async function main() {
  const service = createCNGNService();

  // Usage: tsx src/burn.ts <contractId> <amount>
  const contractId = process.argv[2] ?? process.env.CONTRACT_ID;
  const amount = process.argv[3] ?? process.env.BURN_AMOUNT ?? "1000000";

  if (!contractId) {
    console.log("Usage: npx tsx src/burn.ts <contractId> <amount>");
    console.log("Or set CONTRACT_ID and BURN_AMOUNT in .env");
    return;
  }

  console.log(`Burning ${amount} units from holding ${contractId}...`);
  const result = await service.burn({
    contractId,
    amount,
  });

  console.log("Burn successful!");
  console.dir(result, { depth: null });
}

main().catch(console.error);
