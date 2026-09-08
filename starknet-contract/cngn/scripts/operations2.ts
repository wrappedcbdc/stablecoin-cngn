/**
 * Operations2 interaction script
 *
 * Covers: add_can_mint, remove_can_mint, add_mint_amount, remove_mint_amount,
 *         add_can_forward, remove_can_forward, add_trusted_contract,
 *         add_black_list, remove_black_list,
 *         whitelist_internal_user, whitelist_external_sender,
 *         pause, unpause — plus all read queries.
 *
 * Usage:
 *   STARKNET_NETWORK=local npx tsx scripts/operations2.ts <command> [args...]
 *
 * Multi-signer (Argent multisig / Safe):
 *   Set MULTISIG_ADDRESS + SIGNER_1_KEY + SIGNER_2_KEY ... in .env
 *   All write operations will be sent from the multisig account.
 *
 * Commands:
 *   add-minter          <address>
 *   remove-minter       <address>
 *   set-mint-amount     <address> <amount>
 *   remove-mint-amount  <address>
 *   add-forwarder       <address>
 *   remove-forwarder    <address>
 *   add-trusted         <address>
 *   blacklist           <address>
 *   unblacklist         <address>
 *   whitelist-internal  <address>
 *   whitelist-external  <address>
 *   pause
 *   unpause
 *   can-mint            <address>
 *   can-forward         <address>
 *   mint-amount         <address>
 *   is-blacklisted      <address>
 *   is-internal         <address>
 *   is-external         <address>
 *   is-trusted          <address>
 */

import { Contract } from "starknet";
import { getProvider, getMultisigAccount, getNetwork, loadDeployment, loadAbi, log } from "./utils.js";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    log("Usage: npx tsx scripts/operations2.ts <command> [args...]");
    log("Run with --help to see available commands.");
    process.exit(1);
  }

  const network = getNetwork();
  const provider = getProvider(network);
  const account = getMultisigAccount(provider);
  const contracts = loadDeployment(network);
  const address = contracts.Operations2.address;
  const abi = loadAbi("Operations2");

  const contract = new Contract(abi, address, account);

  log(`Network:     ${network}`);
  log(`Operations2: ${address}`);
  log(`Caller:      ${account.address}`);

  switch (cmd) {
    // ---- WRITE: minter management ----

    case "add-minter": {
      const [minter] = args;
      if (!minter) { log("Usage: add-minter <address>"); process.exit(1); }
      log(`\nAdding minter: ${minter}`);
      const tx = await contract.add_can_mint(minter);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    case "remove-minter": {
      const [minter] = args;
      if (!minter) { log("Usage: remove-minter <address>"); process.exit(1); }
      log(`\nRemoving minter: ${minter}`);
      const tx = await contract.remove_can_mint(minter);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    case "set-mint-amount": {
      const [minter, amount] = args;
      if (!minter || !amount) { log("Usage: set-mint-amount <address> <amount>"); process.exit(1); }
      log(`\nSetting mint amount for ${minter} to ${amount}`);
      const tx = await contract.add_mint_amount(minter, BigInt(amount));
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    case "remove-mint-amount": {
      const [minter] = args;
      if (!minter) { log("Usage: remove-mint-amount <address>"); process.exit(1); }
      log(`\nRemoving mint amount for ${minter}`);
      const tx = await contract.remove_mint_amount(minter);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    // ---- WRITE: forwarder management ----

    case "add-forwarder": {
      const [forwarder] = args;
      if (!forwarder) { log("Usage: add-forwarder <address>"); process.exit(1); }
      log(`\nAdding forwarder: ${forwarder}`);
      const tx = await contract.add_can_forward(forwarder);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    case "remove-forwarder": {
      const [forwarder] = args;
      if (!forwarder) { log("Usage: remove-forwarder <address>"); process.exit(1); }
      log(`\nRemoving forwarder: ${forwarder}`);
      const tx = await contract.remove_can_forward(forwarder);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    // ---- WRITE: trusted contract ----

    case "add-trusted": {
      const [trusted] = args;
      if (!trusted) { log("Usage: add-trusted <address>"); process.exit(1); }
      log(`\nAdding trusted contract: ${trusted}`);
      const tx = await contract.add_trusted_contract(trusted);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    // ---- WRITE: blacklist ----

    case "blacklist": {
      const [target] = args;
      if (!target) { log("Usage: blacklist <address>"); process.exit(1); }
      log(`\nBlacklisting: ${target}`);
      const tx = await contract.add_black_list(target);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    case "unblacklist": {
      const [target] = args;
      if (!target) { log("Usage: unblacklist <address>"); process.exit(1); }
      log(`\nRemoving from blacklist: ${target}`);
      const tx = await contract.remove_black_list(target);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    // ---- WRITE: whitelist ----

    case "whitelist-internal": {
      const [user] = args;
      if (!user) { log("Usage: whitelist-internal <address>"); process.exit(1); }
      log(`\nWhitelisting internal user: ${user}`);
      const tx = await contract.whitelist_internal_user(user);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    case "whitelist-external": {
      const [sender] = args;
      if (!sender) { log("Usage: whitelist-external <address>"); process.exit(1); }
      log(`\nWhitelisting external sender: ${sender}`);
      const tx = await contract.whitelist_external_sender(sender);
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    // ---- WRITE: pause ----

    case "pause": {
      log(`\nPausing Operations2...`);
      const tx = await contract.pause();
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    case "unpause": {
      log(`\nUnpausing Operations2...`);
      const tx = await contract.unpause();
      await provider.waitForTransaction(tx.transaction_hash);
      log(`Done. Tx: ${tx.transaction_hash}`);
      break;
    }

    // ---- READ queries ----

    case "can-mint": {
      const [user] = args;
      if (!user) { log("Usage: can-mint <address>"); process.exit(1); }
      const result = await contract.can_mint(user);
      log(`can_mint(${user}) = ${result}`);
      break;
    }

    case "can-forward": {
      const [user] = args;
      if (!user) { log("Usage: can-forward <address>"); process.exit(1); }
      const result = await contract.can_forward(user);
      log(`can_forward(${user}) = ${result}`);
      break;
    }

    case "mint-amount": {
      const [user] = args;
      if (!user) { log("Usage: mint-amount <address>"); process.exit(1); }
      const result = await contract.mint_amount(user);
      log(`mint_amount(${user}) = ${result.toString()}`);
      break;
    }

    case "is-blacklisted": {
      const [user] = args;
      if (!user) { log("Usage: is-blacklisted <address>"); process.exit(1); }
      const result = await contract.is_black_listed(user);
      log(`is_black_listed(${user}) = ${result}`);
      break;
    }

    case "is-internal": {
      const [user] = args;
      if (!user) { log("Usage: is-internal <address>"); process.exit(1); }
      const result = await contract.is_internal_user_whitelisted(user);
      log(`is_internal_user_whitelisted(${user}) = ${result}`);
      break;
    }

    case "is-external": {
      const [user] = args;
      if (!user) { log("Usage: is-external <address>"); process.exit(1); }
      const result = await contract.is_external_sender_whitelisted(user);
      log(`is_external_sender_whitelisted(${user}) = ${result}`);
      break;
    }

    case "is-trusted": {
      const [addr] = args;
      if (!addr) { log("Usage: is-trusted <address>"); process.exit(1); }
      const result = await contract.trusted_contract(addr);
      log(`trusted_contract(${addr}) = ${result}`);
      break;
    }

    default:
      log(`Unknown command: '${cmd}'`);
      process.exit(1);
  }
}

main().catch((e) => { console.error(`Error: ${e.message}`, e); process.exit(1); });
