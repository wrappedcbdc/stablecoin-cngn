// scripts/multisig/operations/set-mint-amount.ts
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { buildSetMintAmountMessage } from "./helpers";
import { initializeMultisigContext, buildAndSendMultisigTransaction, handleError } from "./shared-utils";

export async function setMintAmount(target: PublicKey, amount: number): Promise<string> {
    console.log("\n=== Set Mint Amount Operation ===");
    console.log("Target:", target.toString());
    console.log("Amount:", amount);

    try {
        const context = await initializeMultisigContext();

        // Set up event listener BEFORE building transaction
        let eventReceived = false;
        const listenerId = context.program.addEventListener('mintAmountUpdatedEvent', (event: any, slot: number) => {
            console.log("\n=== Event Received ===");
            console.log("Event triggered at slot:", slot);
            console.log("Authority:", event.authority.toString());
            console.log("Mint:", event.mint.toString());
            console.log("Amount: $", event.amount.toString());
            console.log("====================\n");
            eventReceived = true;
        });

        // Wait a bit for listener to be active
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Build message and instruction
        const message = buildSetMintAmountMessage(
            context.pdas.canMint,
            target,
            context.multisigAccount.nonce.toNumber()
        );

        const instruction = await context.program.methods
            .setMintAmount(target, new anchor.BN(amount))
            .accounts({
                multisig: context.pdas.multisig,
                mint: context.cngnMint,
                tokenConfig: context.pdas.tokenConfig,
                canMint: context.pdas.canMint,
                instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            })
            .instruction();

        const txSig = await buildAndSendMultisigTransaction(context, message, instruction);
        console.log("Transaction signature:", txSig);

        // Wait for event to be received
        console.log("Waiting for event...");
        const maxWaitTime = 10000;
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

        // Fetch and verify the mint amount
        const fetchedAmount = await context.program.methods
            .getMintAmount(target)
            .accounts({
                mint: context.cngnMint,
                tokenConfig: context.pdas.tokenConfig,
                canMint: context.pdas.canMint
            })
            .view();
        console.log("Mint amount: $",fetchedAmount.toString())
        return txSig;
    } catch (error) {
        handleError(error);
        throw error;
    }
}