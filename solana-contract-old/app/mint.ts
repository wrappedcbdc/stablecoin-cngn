import * as anchor from '@coral-xyz/anchor';

import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';
import { Cngn } from '../target/types/cngn';
import { TokenPDAs } from '../utils/helpers';
import { TOKEN_PARAMS } from '../utils/token_initializer';



/**
 * Mint tokens to a sender
 * @param pdas - token pdas
 * @param program - Anchor program
 * @param mintPublicKey - Token mint address
 * @param users - Keypair with mint authority and sender wallet address(contained in users array)
 * @param payer - Keypair of the payer
 */
export async function mintTokens(
    pdas: TokenPDAs,
    program: anchor.Program<Cngn>,
    mintPublicKey: PublicKey,
    users: any,
    payer: Keypair

) {
    try {
        console.log(`Minting ${TOKEN_PARAMS.mintAmount} tokens to ${users.sender.publicKey.toString()}`);

        // Get the token account of the sender
        const senderTokenAccount = await getAssociatedTokenAddress(
            mintPublicKey,
            users.sender.publicKey
        );

        // Check if token account exists, if not create it
        try {
            await program.provider.connection.getTokenAccountBalance(senderTokenAccount);
        } catch (error) {
            console.log("Creating associated token account for sender...");
            const createATAIx = createAssociatedTokenAccountInstruction(
               payer.publicKey,
                senderTokenAccount,
                users.sender.publicKey,
                mintPublicKey
            );
            const tx = new anchor.web3.Transaction().add(createATAIx);
            await program.provider.sendAndConfirm(tx, [payer]);
        }

        // Mint tokens
        const tx = await program.methods.mint
            (TOKEN_PARAMS.mintAmount)
            .accounts({
                authority: users.authorizedUser.publicKey,
                tokenConfig: pdas.tokenConfig,
                mintAuthority: pdas.mintAuthority,
                mint: mintPublicKey,
                tokenAccount: users.authorizedUserTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                blacklist: pdas.blacklist,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts
            })
            .signers([users.authorizedUser])
            .rpc();

        console.log(`Mint transaction: ${tx}`);
        // Get the token account of the sender
        const senderTokenAccountBalance = await getAccount(program.provider.connection, senderTokenAccount);
        console.log(senderTokenAccountBalance.amount.toString())
        return tx;
    } catch (error) {
        console.error("Error minting tokens:", error);
        throw error;
    }
}