// scripts/multisig/operations/can-forward-operations.ts
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { buildAddCanForwardMessage, buildRemoveCanForwardMessage } from "./helpers";
import { initializeMultisigContext, buildAndSendMultisigTransaction, handleError } from "./shared-utils";

export async function addCanForward(target: PublicKey): Promise<string> {
  console.log("\n=== Add Can Forward Operation ===");
  console.log("Target:", target.toString());

  try {
    const context = await initializeMultisigContext();

    const message = buildAddCanForwardMessage(
      context.pdas.canForward,
      target,
       context.program.programId,
      context.multisigAccount.nonce.toNumber()
    );

    const instruction = await context.program.methods
      .addCanForward(target)
      .accounts({
        mint: context.cngnMint,
        tokenConfig: context.pdas.tokenConfig,
       
        canForward: context.pdas.canForward,
        multisig: context.pdas.multisig,
        instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    return await buildAndSendMultisigTransaction(context, message, instruction);
  } catch (error) {
    handleError(error);
    throw error;
  }
}

export async function removeCanForward(target: PublicKey): Promise<string> {
  console.log("\n=== Remove Can Forward Operation ===");
  console.log("Target:", target.toString());

  try {
    const context = await initializeMultisigContext();

    const message = buildRemoveCanForwardMessage(
      context.pdas.canForward,
      target,
      context.multisigAccount.nonce.toNumber()
    );

    const instruction = await context.program.methods
      .removeCanForward(target)
      .accounts({
        mint: context.cngnMint,
        tokenConfig: context.pdas.tokenConfig,
        canForward: context.pdas.canForward,
        multisig: context.pdas.multisig,
        instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    return await buildAndSendMultisigTransaction(context, message, instruction);
  } catch (error) {
    handleError(error);
    throw error;
  }
}

