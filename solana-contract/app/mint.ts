import * as anchor from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, getAccount, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import { initializeMultisigContext } from './admin/multisig/shared-utils';
import { Keypair, PublicKey } from '@solana/web3.js';
import instruction from '@coral-xyz/anchor/dist/cjs/program/namespace/instruction';



/**
 * Mint tokens to a sender
 * @param pdas - token pdas
 * @param program - Anchor program
 * @param mintPublicKey - Token mint address
 * @param users - Keypair with mint authority and sender wallet address(contained in users array)
 * @param payer - Keypair of the payer
 */
export async function mintTokens(
    sender: Keypair,
    recipient: PublicKey,
    TOKEN_PARAMS: any
) {


    try {
        const context = await initializeMultisigContext();
        console.log(`Minting ${TOKEN_PARAMS.mintAmount} tokens to ${recipient.toString()}`);

        // Get the token account of the recipient
        const recipientTokenAccount = await getAssociatedTokenAddress(
            context.cngnMint,
            recipient,
            false,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Check if token account exists, if not create it
        try {
            await context.program.provider.connection.getTokenAccountBalance(recipientTokenAccount);
        } catch (error) {
            console.log("Creating associated token account for recipient...");
            const createATAIx = createAssociatedTokenAccountIdempotentInstruction(
                context.payer.publicKey,
                recipientTokenAccount,
                recipient,
                context.cngnMint,
                TOKEN_2022_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            );
            const tx = new anchor.web3.Transaction().add(createATAIx);
            await context.program.provider.sendAndConfirm(tx, [context.payer]);
        }


        // Set up event listener BEFORE building transaction
        let eventReceived = false;
        const listenerId = context.program.addEventListener('tokenMintEvent', (event: any, slot: number) => {
            console.log("\n=== Event Received ===");
            console.log("Event triggered at slot:", slot);
            console.log("recipient:", event.to.toString());
            console.log("Token Mint address:", event.mint.toString());
            console.log("Amount minted:", event.amount.toString());
            console.log("====================\n");
            eventReceived = true;
        });

        // Wait a bit for listener to be active
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mint tokens
        const tx = await context.program.methods.mint
            (TOKEN_PARAMS.mintAmount)
            .accounts({
                authority: sender.publicKey,
                tokenConfig: context.pdas.tokenConfig,
                mintAuthority: context.pdas.mintAuthority,
                mint: context.cngnMint,
                tokenAccount: recipientTokenAccount,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                blacklist: context.pdas.blacklist,
                canMint: context.pdas.canMint,
                trustedContracts: context.pdas.trustedContracts
            })
            .signers([sender])
            .rpc();

        console.log(`Mint transaction: ${tx}`);
        // Get the token account of the recipient to confirm balance
        const recipientTokenAccountBalance = await getAccount(context.program.provider.connection, recipientTokenAccount, null, TOKEN_2022_PROGRAM_ID);
        console.log(parseInt(recipientTokenAccountBalance.amount.toString())/10**6)

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

        return tx;
    } catch (error) {
        console.error("Error minting tokens:", error);
        throw error;
    }
}