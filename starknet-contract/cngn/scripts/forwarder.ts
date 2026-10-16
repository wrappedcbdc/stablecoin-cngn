/**
 * Forwarder contract interaction script
 *
 * Covers: authorize_bridge, deauthorize_bridge,
 *         update_admin_operations_address, pause, unpause
 *         — plus all read queries.
 *
 * Usage:
 *   STARKNET_NETWORK=local npx tsx scripts/forwarder.ts <command> [args...]
 *
 * Commands:
 *   authorize-bridge    <bridge_address>
 *   deauthorize-bridge  <bridge_address>
 *   update-admin-ops    <new_address>
 *   pause
 *   unpause
 *   is-authorized       <bridge_address>
 *   is-processed        <tx_hash_felt252>
 *   get-nonce           <address>
 *   admin-ops
 */

import { Contract } from "starknet";
import { getProvider, getAccount, getNetwork, loadDeployment, loadAbi, log } from "./utils.js";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    log("Usage: npx tsx scripts/forwarder.ts <command> [args...]", "yellow");
    process.exit(1);
  }

  const network = getNetwork();
  const provider = getProvider(network);
  const account = getAccount(provider);
  const contracts = loadDeployment(network);
  const address = contracts.Forwarder.address;
  const abi = loadAbi("Forwarder");

  const contract = new Contract(abi, address, account);

  log(`Network:   ${network}`, "cyan");
  log(`Forwarder: ${address}`, "cyan");
  log(`Caller:    ${account.address}`, "cyan");

  switch (cmd) {
    // ---- WRITE: bridge management ----

    case "authorize-bridge": {
      const [bridge] = args;
      if (!bridge) { log("Usage: authorize-bridge <bridge_address>", "red"); process.exit(1); }
      log(`\nAuthorizing bridge: ${bridge}`, "blue");
      const tx = await contract.authorize_bridge(bridge);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    case "deauthorize-bridge": {
      const [bridge] = args;
      if (!bridge) { log("Usage: deauthorize-bridge <bridge_address>", "red"); process.exit(1); }
      log(`\nDeauthorizing bridge: ${bridge}`, "blue");
      const tx = await contract.deauthorize_bridge(bridge);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    // ---- WRITE: admin ops update ----

    case "update-admin-ops": {
      const [newAddr] = args;
      if (!newAddr) { log("Usage: update-admin-ops <new_address>", "red"); process.exit(1); }
      log(`\nUpdating admin operations to: ${newAddr}`, "blue");
      const tx = await contract.update_admin_operations_address(newAddr);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    // ---- WRITE: pause ----

    case "pause": {
      log(`\nPausing Forwarder...`, "blue");
      const tx = await contract.pause();
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    case "unpause": {
      log(`\nUnpausing Forwarder...`, "blue");
      const tx = await contract.unpause();
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    // ---- READ queries ----

    case "is-authorized": {
      const [bridge] = args;
      if (!bridge) { log("Usage: is-authorized <bridge_address>", "red"); process.exit(1); }
      const result = await contract.is_authorized_bridge(bridge);
      log(`is_authorized_bridge(${bridge}) = ${result}`, "green");
      break;
    }

    case "is-processed": {
      const [txHash] = args;
      if (!txHash) { log("Usage: is-processed <tx_hash_felt252>", "red"); process.exit(1); }
      const result = await contract.is_processed(txHash);
      log(`is_processed(${txHash}) = ${result}`, "green");
      break;
    }

    case "get-nonce": {
      const [user] = args;
      if (!user) { log("Usage: get-nonce <address>", "red"); process.exit(1); }
      const result = await contract.get_nonce(user);
      log(`get_nonce(${user}) = ${result.toString()}`, "green");
      break;
    }

    case "admin-ops": {
      const result = await contract.admin_operations_contract();
      log(`admin_operations_contract() = ${result}`, "green");
      break;
    }

    default:
      log(`Unknown command: '${cmd}'`, "red");
      process.exit(1);
  }
}

main().catch((e) => { log(`Error: ${e.message}`, "red"); console.error(e); process.exit(1); });
