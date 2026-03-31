/**
 * Cngn2 token interaction script
 *
 * Covers: mint, transfer, transfer_from, approve, burn_by_user,
 *         destroy_black_funds, pause, unpause,
 *         update_admin_operations_address, update_forwarder_contract
 *         — plus all read queries.
 *
 * Usage:
 *   STARKNET_NETWORK=local npx tsx scripts/cngn2.ts <command> [args...]
 *
 * Commands:
 *   mint              <amount> <recipient>
 *   transfer          <recipient> <amount>
 *   transfer-from     <sender> <recipient> <amount>
 *   approve           <spender> <amount>
 *   burn              <amount>
 *   destroy-funds     <blacklisted_address>
 *   pause
 *   unpause
 *   update-admin-ops  <new_address>
 *   update-forwarder  <new_address>
 *   balance           <address>
 *   allowance         <owner> <spender>
 *   total-supply
 *   name
 *   symbol
 *   decimals
 *   trusted-forwarder
 *   admin-ops
 *   is-trusted-forwarder <address>
 */

import { Contract } from "starknet";
import { getProvider, getAccount, getNetwork, loadDeployment, loadAbi, log } from "./utils.js";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    log("Usage: npx tsx scripts/cngn2.ts <command> [args...]", "yellow");
    process.exit(1);
  }

  const network = getNetwork();
  const provider = getProvider(network);
  const account = getAccount(provider);
  const contracts = loadDeployment(network);
  const address = contracts.Cngn2.address;
  const abi = loadAbi("Cngn2");

  const contract = new Contract(abi, address, account);

  log(`Network: ${network}`, "cyan");
  log(`Cngn2:   ${address}`, "cyan");
  log(`Caller:  ${account.address}`, "cyan");

  switch (cmd) {
    // ---- WRITE: minting ----

    case "mint": {
      // Requires: caller must have can_mint=true and matching mint_amount set in Operations2
      const [amount, recipient] = args;
      if (!amount || !recipient) { log("Usage: mint <amount> <recipient>", "red"); process.exit(1); }
      log(`\nMinting ${amount} to ${recipient}...`, "blue");
      log(`Note: caller must be an authorized minter with the exact mint_amount set.`, "yellow");
      const tx = await contract.mint(BigInt(amount), recipient);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    // ---- WRITE: transfers ----

    case "transfer": {
      const [recipient, amount] = args;
      if (!recipient || !amount) { log("Usage: transfer <recipient> <amount>", "red"); process.exit(1); }
      log(`\nTransferring ${amount} to ${recipient}...`, "blue");
      const tx = await contract.transfer(recipient, BigInt(amount));
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    case "transfer-from": {
      const [sender, recipient, amount] = args;
      if (!sender || !recipient || !amount) {
        log("Usage: transfer-from <sender> <recipient> <amount>", "red");
        process.exit(1);
      }
      log(`\nTransferring ${amount} from ${sender} to ${recipient}...`, "blue");
      const tx = await contract.transfer_from(sender, recipient, BigInt(amount));
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    case "approve": {
      const [spender, amount] = args;
      if (!spender || !amount) { log("Usage: approve <spender> <amount>", "red"); process.exit(1); }
      log(`\nApproving ${spender} to spend ${amount}...`, "blue");
      const tx = await contract.approve(spender, BigInt(amount));
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    // ---- WRITE: burn ----

    case "burn": {
      const [amount] = args;
      if (!amount) { log("Usage: burn <amount>", "red"); process.exit(1); }
      log(`\nBurning ${amount} tokens (caller burns their own)...`, "blue");
      const tx = await contract.burn_by_user(BigInt(amount));
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    case "destroy-funds": {
      // Owner-only: destroys all tokens held by a blacklisted address
      const [target] = args;
      if (!target) { log("Usage: destroy-funds <blacklisted_address>", "red"); process.exit(1); }
      log(`\nDestroying black funds for: ${target}`, "blue");
      log(`Note: address must be blacklisted in Operations2 first.`, "yellow");
      const tx = await contract.destroy_black_funds(target);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    // ---- WRITE: pause ----

    case "pause": {
      log(`\nPausing Cngn2...`, "blue");
      const tx = await contract.pause();
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    case "unpause": {
      log(`\nUnpausing Cngn2...`, "blue");
      const tx = await contract.unpause();
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    // ---- WRITE: admin ----

    case "update-admin-ops": {
      const [newAddr] = args;
      if (!newAddr) { log("Usage: update-admin-ops <new_address>", "red"); process.exit(1); }
      log(`\nUpdating admin operations contract to: ${newAddr}`, "blue");
      const tx = await contract.update_admin_operations_address(newAddr);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    case "update-forwarder": {
      const [newAddr] = args;
      if (!newAddr) { log("Usage: update-forwarder <new_address>", "red"); process.exit(1); }
      log(`\nUpdating forwarder contract to: ${newAddr}`, "blue");
      const tx = await contract.update_forwarder_contract(newAddr);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`, "green");
      break;
    }

    // ---- READ queries ----

    case "balance": {
      const [user] = args;
      if (!user) { log("Usage: balance <address>", "red"); process.exit(1); }
      const result = await contract.balance_of(user);
      log(`balance_of(${user}) = ${result.toString()}`, "green");
      break;
    }

    case "allowance": {
      const [owner, spender] = args;
      if (!owner || !spender) { log("Usage: allowance <owner> <spender>", "red"); process.exit(1); }
      const result = await contract.allowance(owner, spender);
      log(`allowance(${owner}, ${spender}) = ${result.toString()}`, "green");
      break;
    }

    case "total-supply": {
      const result = await contract.total_supply();
      log(`total_supply() = ${result.toString()}`, "green");
      break;
    }

    case "name": {
      const result = await contract.name();
      log(`name() = ${result}`, "green");
      break;
    }

    case "symbol": {
      const result = await contract.symbol();
      log(`symbol() = ${result}`, "green");
      break;
    }

    case "decimals": {
      const result = await contract.decimals();
      log(`decimals() = ${result}`, "green");
      break;
    }

    case "trusted-forwarder": {
      const result = await contract.trusted_forwarder_contract();
      log(`trusted_forwarder_contract() = ${result}`, "green");
      break;
    }

    case "admin-ops": {
      const result = await contract.admin_operations_contract();
      log(`admin_operations_contract() = ${result}`, "green");
      break;
    }

    case "is-trusted-forwarder": {
      const [addr] = args;
      if (!addr) { log("Usage: is-trusted-forwarder <address>", "red"); process.exit(1); }
      const result = await contract.is_trusted_forwarder(addr);
      log(`is_trusted_forwarder(${addr}) = ${result}`, "green");
      break;
    }

    default:
      log(`Unknown command: '${cmd}'`, "red");
      process.exit(1);
  }
}

main().catch((e) => { log(`Error: ${e.message}`, "red"); console.error(e); process.exit(1); });
