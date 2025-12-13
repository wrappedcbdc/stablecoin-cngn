import * as anchor from '@coral-xyz/anchor';

import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';



/**
 * Transfer tokens between accounts
 * @param program - Anchor program
 * @param mintPublicKey - Token mint address
 * @param senderPublicKey - Sender wallet address
 * @param recipientPublicKey - Recipient wallet address
 * @param amount - Amount to transfer
 * @param senderKeypair - Keypair of the sender
 */
export async function transferTokens(
    program: anchor.Program,
    mintPublicKey: PublicKey,
    senderPublicKey: PublicKey,
    recipientPublicKey: PublicKey,
    amount: number,
    senderKeypair: Keypair
  ) {
    try {
      console.log(`Transferring ${amount} tokens from ${senderPublicKey.toString()} to ${recipientPublicKey.toString()}`);
      
      // Get token accounts
      const senderTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        senderPublicKey
      );
      
      const recipientTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        recipientPublicKey
      );
      
      // Check if recipient token account exists, if not create it
      try {
        await program.provider.connection.getTokenAccountBalance(recipientTokenAccount);
      } catch (error) {
        console.log("Creating associated token account for recipient...");
        const createATAIx = createAssociatedTokenAccountInstruction(
          senderKeypair.publicKey,
          recipientTokenAccount,
          recipientPublicKey,
          mintPublicKey
        );
        const tx = new anchor.web3.Transaction().add(createATAIx);
        await program.provider.sendAndConfirm(tx, [senderKeypair]);
      }
      
      // Transfer tokens
      const tx = await program.methods
        .transfer(new anchor.BN(amount))
        .accounts({
          source: senderTokenAccount,
          destination: recipientTokenAccount,
          authority: senderKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([senderKeypair])
        .rpc();
      
      console.log(`Transfer transaction: ${tx}`);
      return tx;
    } catch (error) {
      console.error("Error transferring tokens:", error);
      throw error;
    }
  }