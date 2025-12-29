// scripts/multisig/operations/update-multisig.ts
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { buildUpdateMultisigMessage } from "./helpers";
import { initializeMultisigContext, buildAndSendMultisigTransaction, handleError } from "./shared-utils";

export async function updateMultisig(
  newOwners: PublicKey[],
  newThreshold: number
): Promise<string> {
  console.log("\n=== Update Multisig Operation ===");
  console.log("New Owners:", newOwners.map(o => o.toString()));
  console.log("New Threshold:", newThreshold);

  try {
    const context = await initializeMultisigContext();

    // Validate inputs
    if (newOwners.length === 0) {
      throw new Error("Must provide at least one owner");
    }

    if (newThreshold <= 0 || newThreshold > newOwners.length) {
      throw new Error(`Invalid threshold: must be between 1 and ${newOwners.length}`);
    }

    // Check for duplicate owners
    const uniqueOwners = new Set(newOwners.map(o => o.toString()));
    if (uniqueOwners.size !== newOwners.length) {
      throw new Error("Duplicate owners detected");
    }

    // Build message and instruction
    const message = buildUpdateMultisigMessage(
      context.pdas.multisig,
      newOwners,
      newThreshold,
      context.multisigAccount.nonce.toNumber()
    );

    const instruction = await context.program.methods
      .updateMultisig(newOwners, newThreshold)
      .accounts({
        multisig: context.pdas.multisig,
        mint: context.cngnMint,
        instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    return await buildAndSendMultisigTransaction(context, message, instruction);
  } catch (error) {
    handleError(error);
    throw error;
  }
}

