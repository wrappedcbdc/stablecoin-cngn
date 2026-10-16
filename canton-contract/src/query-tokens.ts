import "dotenv/config";
import { CantonClient, TEMPLATE_IDS } from "./client.js";
import { CNGNService } from "./cngn-service.js";

async function main() {
  const token = process.env.CANTON_JWT ?? process.env.CANTON_ACCESS_TOKEN;
  if (!token) throw new Error("CANTON_JWT or CANTON_ACCESS_TOKEN is required");

  const canton = new CantonClient(token);
  const service = new CNGNService(canton);

  console.log("=== Querying Canton Ledger Contracts ===");

  const templates = [
    ["cNGN Token Holdings", TEMPLATE_IDS.token],
    ["Mint Proposals", TEMPLATE_IDS.mintProposal],
    ["Allowances", TEMPLATE_IDS.allowance],
    ["Admin Compliance State", TEMPLATE_IDS.adminState],
    ["Mint Registry", TEMPLATE_IDS.mintRegistry],
    ["Forwarder Registry", TEMPLATE_IDS.forwarderRegistry],
    ["Trusted Contract Registry", TEMPLATE_IDS.trustedContractRegistry],
    ["Nonce Tracker", TEMPLATE_IDS.nonceTracker],
    ["Forward Requests", TEMPLATE_IDS.forwardRequest],
  ] as const;

  for (const [name, templateId] of templates) {
    try {
      const contracts = await canton.query(templateId);
      console.log(`\n📌 ${name}: ${contracts.length} active contract(s)`);
      if (contracts.length > 0) {
        console.dir(contracts, { depth: null });
      }
    } catch (err: unknown) {
      console.warn(`⚠️  Failed to query ${name}: ${(err as Error).message}`);
    }
  }

  // Summary of Owner balance if OWNER party is defined
  const owner = process.env.OWNER ?? process.env.CNGN_ISSUER_PARTY;
  if (owner) {
    try {
      const balance = await service.getBalance(owner);
      console.log(`\n💰 Total Balance for ${owner}:`);
      console.log(`   Atomic: ${balance.raw} (6 decimals)`);
      console.log(`   Formatted: ${balance.formatted} cNGN`);
    } catch (err: unknown) {
      console.warn(`⚠️  Failed to get balance: ${(err as Error).message}`);
    }
  }
}

main().catch(console.error);