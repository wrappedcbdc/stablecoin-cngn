
import * as anchor from '@coral-xyz/anchor';

import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';



/**
 * Burn tokens
 * @param program - Anchor program
 * @param mintPublicKey - Token mint address
 * @param ownerPublicKey - Token owner wallet address
 * @param amount - Amount to burn
 * @param ownerKeypair - Keypair of the owner
 */
export async function burnTokens(
    program: anchor.Program,
    mintPublicKey: PublicKey,
    ownerPublicKey: PublicKey,
    amount: number,
    ownerKeypair: Keypair
  ) {
    try {
      console.log(`Burning ${amount} tokens from ${ownerPublicKey.toString()}`);
      
      // Get token account
      const tokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        ownerPublicKey
      );
      
      // Burn tokens
      const tx = await program.methods
        .burn(new anchor.BN(amount))
        .accounts({
          mint: mintPublicKey,
          tokenAccount: tokenAccount,
          authority: ownerPublicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([ownerKeypair])
        .rpc();
      
      console.log(`Burn transaction: ${tx}`);
      return tx;
    } catch (error) {
      console.error("Error burning tokens:", error);
      throw error;
    }
  }