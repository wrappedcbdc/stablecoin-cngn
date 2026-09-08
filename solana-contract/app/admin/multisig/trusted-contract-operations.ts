// scripts/multisig/operations/trusted-contract-operations.ts
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { buildAddTrustedContractMessage, buildRemoveTrustedContractMessage } from "./helpers";
import { initializeMultisigContext, buildAndSendMultisigTransaction, handleError } from "./shared-utils";

export async function addTrustedContract(target: PublicKey): Promise<string> {
  console.log("\n=== Add Trusted Contract Operation ===");
  console.log("Target:", target.toString());

  try {
    const context = await initializeMultisigContext();

    const message = buildAddTrustedContractMessage(
      context.pdas.trustedContracts,
      target,
      context.multisigAccount.nonce.toNumber()
    );

    const instruction = await context.program.methods
      .addTrustedContract(target)
      .accounts({
        mint: context.cngnMint,
        tokenConfig: context.pdas.tokenConfig,
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

export async function removeTrustedContract(target: PublicKey): Promise<string> {
  console.log("\n=== Remove Trusted Contract Operation ===");
  console.log("Target:", target.toString());

  try {
    const context = await initializeMultisigContext();

    const message = buildRemoveTrustedContractMessage(
      context.pdas.trustedContracts,
      target,
      context.multisigAccount.nonce.toNumber()
    );

    const instruction = await context.program.methods
      .removeTrustedContract(target)
      .accounts({
        mint: context.cngnMint,
        tokenConfig: context.pdas.tokenConfig,
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
