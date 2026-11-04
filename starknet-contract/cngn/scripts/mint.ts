/**
 * Full mint workflow script
 *
 * Replicates the exact flow validated by the tests:
 *   1. add_can_mint(minter)       → Operations2  (owner calls)
 *   2. add_mint_amount(minter, n) → Operations2  (owner calls)
 *   3. mint(n, recipient)         → Cngn2        (minter calls)
 *
 * After a successful mint the minter's mint_amount is cleared to 0
 * and can_mint revoked, so every mint needs steps 1-2 again
 * (this is the "controlled minting" design).
 *
 * Usage:
 *   STARKNET_NETWORK=local npx tsx scripts/mint.ts <amount> <recipient> [minter]
 *
 *   amount    — token units in base denomination (6 decimals). e.g. 1000000 = 1 cNGN
 *   recipient — address that will receive the tokens
 *   minter    — address that will call mint() (defaults to STARKNET_ACCOUNT_ADDRESS)
 *
 * The script assumes the caller (STARKNET_ACCOUNT_ADDRESS) is the contract owner.
 * If minter != owner, the owner authorizes the minter, and a separate
 * MINTER_PRIVATE_KEY / MINTER_ACCOUNT_ADDRESS can be set in .env to execute the mint step.
 */

import { Account, Contract } from "starknet";
import { getProvider, getAccount, getNetwork, loadDeployment, loadAbi, log } from "./utils.js";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [amountArg, recipient, minterArg] = process.argv.slice(2);

  if (!amountArg || !recipient) {
    log("Usage: npx tsx scripts/mint.ts <amount> <recipient> [minter]", "yellow");
    log("  amount    — base units (6 decimals). 1000000 = 1 cNGN", "yellow");
    log("  recipient — address to receive tokens", "yellow");
    log("  minter    — defaults to STARKNET_ACCOUNT_ADDRESS", "yellow");
    process.exit(1);
  }

  const amount = BigInt(amountArg);
  const network = getNetwork();
  const provider = getProvider(network);
  const ownerAccount = getAccount(provider);

  // Minter account (defaults to owner if not overridden)
  const minterAddress = minterArg || ownerAccount.address;
  const minterPrivateKey = process.env.MINTER_PRIVATE_KEY || process.env.STARKNET_PRIVATE_KEY!;
  const minterAccount = new Account(provider, minterAddress, minterPrivateKey);

  const contracts = loadDeployment(network);
  const ops2Abi = loadAbi("Operations2");
  const cngn2Abi = loadAbi("Cngn2");

  const ops2 = new Contract(ops2Abi, contracts.Operations2.address, ownerAccount);
  const cngn2 = new Contract(cngn2Abi, contracts.Cngn2.address, minterAccount);

  log("========================================", "blue");
  log("   cNGN2 Mint Workflow", "blue");
  log("========================================", "blue");
  log(`Network:     ${network}`, "cyan");
  log(`Operations2: ${contracts.Operations2.address}`, "cyan");
  log(`Cngn2:       ${contracts.Cngn2.address}`, "cyan");
  log(`Owner:       ${ownerAccount.address}`, "cyan");
  log(`Minter:      ${minterAddress}`, "cyan");
  log(`Recipient:   ${recipient}`, "cyan");
  log(`Amount:      ${amount.toString()} (${Number(amount) / 1e6} cNGN)`, "cyan");

  // Step 1: authorize minter
  log("\n[1/3] Authorizing minter...", "blue");
  const tx1 = await ops2.add_can_mint(minterAddress);
  await provider.waitForTransaction(tx1.transaction_hash);
  log(`      can_mint set. Tx: ${tx1.transaction_hash}`, "green");

  // Step 2: set the exact mint amount
  log("\n[2/3] Setting mint amount...", "blue");
  const tx2 = await ops2.add_mint_amount(minterAddress, amount);
  await provider.waitForTransaction(tx2.transaction_hash);
  log(`      mint_amount set to ${amount}. Tx: ${tx2.transaction_hash}`, "green");

  // Step 3: minter calls mint — amount must match exactly
  log("\n[3/3] Minting tokens...", "blue");
  const tx3 = await cngn2.mint(amount, recipient);
  await provider.waitForTransaction(tx3.transaction_hash);
  log(`      Minted. Tx: ${tx3.transaction_hash}`, "green");

  // Verify
  const balance = await cngn2.balance_of(recipient);
  const supply = await cngn2.total_supply();

  log("\n========================================", "green");
  log("   Mint Complete", "green");
  log("========================================", "green");
  log(`Recipient balance: ${balance.toString()}`, "green");
  log(`Total supply:      ${supply.toString()}`, "green");
}

main().catch((e) => { log(`Error: ${e.message}`, "red"); console.error(e); process.exit(1); });
