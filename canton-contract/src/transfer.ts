import "dotenv/config";
import { createCNGNService } from "../cngn.js";

async function main() {
  const service = createCNGNService();

  // Usage: tsx src/transfer.ts <contractId> <toParty> <amount>
  const contractId = process.argv[2] ?? process.env.CONTRACT_ID;
  const to = process.argv[3] ?? process.env.TRANSFER_TO;
  const amount = process.argv[4] ?? process.env.TRANSFER_AMOUNT ?? "1000000";

  if (!contractId || !to) {
    console.log("Usage: npx tsx src/transfer.ts <contractId> <toParty> <amount>");
    console.log("Or set CONTRACT_ID, TRANSFER_TO, and TRANSFER_AMOUNT in .env");
    return;
  }

  console.log(`Transferring ${amount} cNGN from holding ${contractId} to ${to}...`);
  const result = await service.transfer({
    contractId,
    to,
    amount,
  });

  console.log("Transfer successful!");
  console.dir(result, { depth: null });
}

main().catch(console.error);
