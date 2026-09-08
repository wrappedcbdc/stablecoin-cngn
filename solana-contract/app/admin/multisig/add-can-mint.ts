// scripts/multisig/operations/add-can-mint.ts
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { buildAddCanMintMessage } from "./helpers";
import { initializeMultisigContext, buildAndSendMultisigTransaction, handleError } from "./shared-utils";

export async function addCanMint(target: PublicKey): Promise<string> {
    console.log("\n=== Add Can Mint Operation ===");
    console.log("Target:", target.toString());

    try {
        const context = await initializeMultisigContext();

        // Set up event listener BEFORE building transaction
        let eventReceived = false;
        const listenerId = context.program.addEventListener('whitelistedMinter', (event: any, slot: number) => {
            console.log("\n=== Event Received ===");
            console.log("Event triggered at slot:", slot);
            console.log("Minter Address:", event.authority.toString());
            console.log("Token Mint address:", event.mint.toString());
            console.log("====================\n");
            eventReceived = true;
        });

        // Wait a bit for listener to be active
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Build message and instruction
        const message = buildAddCanMintMessage(
            context.pdas.canMint,
            target,
            context.multisigAccount.nonce.toNumber()
        );

        const instruction = await context.program.methods
            .addCanMint(target)
            .accounts({
                mint: context.cngnMint,
                tokenConfig: context.pdas.tokenConfig,
                blacklist: context.pdas.blacklist,
                canMint: context.pdas.canMint,
                trustedContracts: context.pdas.trustedContracts,
                multisig: context.pdas.multisig,
                instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            })
            .instruction();

        const txSig = await buildAndSendMultisigTransaction(context, message, instruction);
        console.log("Transaction signature:", txSig);

        // Wait for event to be received (with timeout)
        console.log("Waiting for event...");
        const maxWaitTime = 10000; // 10 seconds should be enough
        const startTime = Date.now();

        while (!eventReceived && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (eventReceived) {
            console.log("✓ Event successfully received!");
        } else {
            console.warn("⚠ Warning: Event not received within timeout period");
            console.log("This doesn't mean the transaction failed - check the explorer link above");
        }

        // Remove event listener
        await context.program.removeEventListener(listenerId);
        return txSig;
    } catch (error) {
        handleError(error);
        throw error;
    }
}