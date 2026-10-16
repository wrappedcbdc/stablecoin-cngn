import "dotenv/config";
import { createCNGNService } from "../cngn.js";

async function main() {
  const service = createCNGNService();
  const owner = process.env.OWNER ?? process.env.CNGN_ISSUER_PARTY;

  const command = process.argv[2] ?? "status";

  const adminStates = await service.getAdminState(owner);
  if (!adminStates.length) {
    console.error("No AdminState contract found for owner:", owner);
    return;
  }

  const adminStateCid = adminStates[0].contractId;
  const current = adminStates[0].payload;

  if (command === "status") {
    console.log("=== Admin Compliance Status ===");
    console.log("Contract ID:", adminStateCid);
    console.log("Owner:", current.owner);
    console.log("Global Paused:", current.globalPaused);
    console.log("Blacklisted Parties:", current.blackListed);
  } else if (command === "pause") {
    console.log(`Executing global emergency pause on ${adminStateCid}...`);
    const res = await service.pauseAll(adminStateCid);
    console.log("Global pause successful!");
    console.dir(res, { depth: null });
  } else if (command === "unpause") {
    console.log(`Lifting global emergency pause on ${adminStateCid}...`);
    const res = await service.unpauseAll(adminStateCid);
    console.log("Global unpause successful!");
    console.dir(res, { depth: null });
  } else if (command === "blacklist-add") {
    const user = process.argv[3];
    if (!user) throw new Error("Usage: npx tsx src/admin.ts blacklist-add <userParty>");
    console.log(`Adding ${user} to blacklist...`);
    const res = await service.addBlacklist(adminStateCid, user);
    console.log("Blacklist updated!");
    console.dir(res, { depth: null });
  } else if (command === "blacklist-remove") {
    const user = process.argv[3];
    if (!user) throw new Error("Usage: npx tsx src/admin.ts blacklist-remove <userParty>");
    console.log(`Removing ${user} from blacklist...`);
    const res = await service.removeBlacklist(adminStateCid, user);
    console.log("Blacklist removal successful!");
    console.dir(res, { depth: null });
  } else {
    console.log("Available commands: status, pause, unpause, blacklist-add <party>, blacklist-remove <party>");
  }
}

main().catch(console.error);
