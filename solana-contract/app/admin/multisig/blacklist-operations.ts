// scripts/multisig/operations/blacklist-operations.ts
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { buildAddBlacklistMessage, buildRemoveBlacklistMessage } from "./helpers";
import { initializeMultisigContext, buildAndSendMultisigTransaction, handleError } from "./shared-utils";

export async function addBlacklist(target: PublicKey): Promise<string> {
  console.log("\n=== Add Blacklist Operation ===");
  console.log("Target:", target.toString());

  try {
    const context = await initializeMultisigContext();

    const message = buildAddBlacklistMessage(
      context.pdas.blacklist,
      target,
      context.multisigAccount.nonce.toNumber()
    );

    const instruction = await context.program.methods
      .addBlacklist(target)
      .accounts({
        mint: context.cngnMint,
        tokenConfig: context.pdas.tokenConfig,
        canMint: context.pdas.canMint,
        internalWhitelist: context.pdas.internalWhitelist,
        externalWhitelist: context.pdas.externalWhitelist,
        trustedContracts: context.pdas.trustedContracts,
        canForward: context.pdas.canForward,
        blacklist: context.pdas.blacklist,
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

export async function removeBlacklist(target: PublicKey): Promise<string> {
  console.log("\n=== Remove Blacklist Operation ===");
  console.log("Target:", target.toString());

  try {
    const context = await initializeMultisigContext();

    const message = buildRemoveBlacklistMessage(
      context.pdas.blacklist,
      target,
      context.multisigAccount.nonce.toNumber()
    );

    const instruction = await context.program.methods
      .removeBlacklist(target)
      .accounts({
        mint: context.cngnMint,
        tokenConfig: context.pdas.tokenConfig,
        blacklist: context.pdas.blacklist,
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

