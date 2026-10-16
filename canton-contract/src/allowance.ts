import "dotenv/config";
import { createCNGNService } from "../cngn.js";

async function main() {
  const service = createCNGNService();

  const command = process.argv[2] ?? "list";

  if (command === "create") {
    const tokenOwner = process.argv[3] ?? process.env.OWNER;
    const spender = process.argv[4] ?? process.env.SPENDER;
    const amount = process.argv[5] ?? process.env.ALLOWANCE_AMOUNT ?? "500000";

    if (!tokenOwner || !spender) {
      console.log("Usage: npx tsx src/allowance.ts create <tokenOwner> <spender> <amount>");
      return;
    }

    console.log(`Creating allowance: ${tokenOwner} authorizes ${spender} for ${amount}...`);
    const result = await service.createAllowance({ tokenOwner, spender, amount });
    console.log("Allowance created!");
    console.dir(result, { depth: null });
  } else {
    console.log("Listing active allowances...");
    const allowances = await service.getAllowances();
    console.log(`Found ${allowances.length} active allowance(s):`);
    console.dir(allowances, { depth: null });
  }
}

main().catch(console.error);
