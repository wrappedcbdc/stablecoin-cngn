// scripts/multisig/operations/whitelist-operations.ts
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  buildWhitelistInternalMessage,
  buildWhitelistExternalMessage,
  buildBlacklistInternalMessage,
  buildBlacklistExternalMessage,
} from "./helpers";
import { initializeMultisigContext, buildAndSendMultisigTransaction, handleError } from "./shared-utils";

export async function whitelistInternal(target: PublicKey): Promise<string> {
  console.log("\n=== Whitelist Internal User Operation ===");
  console.log("Target:", target.toString());

  try {
    const context = await initializeMultisigContext();

    const message = buildWhitelistInternalMessage(
      context.pdas.internalWhitelist,
      target,
      context.multisigAccount.nonce.toNumber()
    );

    const instruction = await context.program.methods
      .whitelistInternalUser(target)
      .accounts({
        mint: context.cngnMint,
        tokenConfig: context.pdas.tokenConfig,
        internalWhitelist: context.pdas.internalWhitelist,
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

export async function whitelistExternal(target: PublicKey): Promise<string> {
  console.log("\n=== Whitelist External User Operation ===");
  console.log("Target:", target.toString());

  try {
    const context = await initializeMultisigContext();

    const message = buildWhitelistExternalMessage(
      context.pdas.externalWhitelist,
      target,
      context.multisigAccount.nonce.toNumber()
    );

    const instruction = await context.program.methods
      .whitelistExternalUser(target)
      .accounts({
        mint: context.cngnMint,
        tokenConfig: context.pdas.tokenConfig,
        externalWhitelist: context.pdas.externalWhitelist,
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

export async function blacklistInternal(target: PublicKey): Promise<string> {
  console.log("\n=== Blacklist Internal User Operation ===");
  console.log("Target:", target.toString());

  try {
    const context = await initializeMultisigContext();

    const message = buildBlacklistInternalMessage(
      context.pdas.internalWhitelist,
      target,
      context.multisigAccount.nonce.toNumber()
    );

    const instruction = await context.program.methods
      .blacklistInternalUser(target)
      .accounts({
        mint: context.cngnMint,
        tokenConfig: context.pdas.tokenConfig,
        internalWhitelist: context.pdas.internalWhitelist,
        trustedContracts: context.pdas.trustedContracts,
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

export async function blacklistExternal(target: PublicKey): Promise<string> {
  console.log("\n=== Blacklist External User Operation ===");
  console.log("Target:", target.toString());

  try {
    const context = await initializeMultisigContext();

    const message = buildBlacklistExternalMessage(
      context.pdas.externalWhitelist,
      target,
      context.multisigAccount.nonce.toNumber()
    );

    const instruction = await context.program.methods
      .blacklistExternalUser(target)
      .accounts({
        mint: context.cngnMint,
        tokenConfig: context.pdas.tokenConfig,
        externalWhitelist: context.pdas.externalWhitelist,
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

