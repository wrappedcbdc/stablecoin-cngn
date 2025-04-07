import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { createTokenAccountIfNeeded, TokenPDAs } from './helpers';
import { BN } from '@coral-xyz/anchor';

/**
 * Token parameters configuration
 */
export const TOKEN_PARAMS = {
  name: "cNGN",
  symbol: "cNGN",
  decimals: 6,
  mintAmount: new anchor.BN(10_000_000_000), // 10,000 tokens with 6 decimals
  transferAmount: new anchor.BN(5_000_000_000), // 5,000 tokens
  partialAmount: new anchor.BN(2_500_000_000) // 2,500 tokens
};

/**
 * Initializes a token with all required accounts
 * @param program - The Anchor program
 * @param provider - The Anchor provider
 * @param mint - The mint keypair
 * @param pdas - PDAs for the token
 */
export async function initializeToken(
  program: any,
  provider: anchor.AnchorProvider,
  mint: Keypair,
  pdas: TokenPDAs
): Promise<void> {
  console.log("=========== Initializing token ========");
  
  // Execute the initialization transaction
  const tx = await program.methods
    .initialize(TOKEN_PARAMS.name, TOKEN_PARAMS.symbol, TOKEN_PARAMS.decimals)
    .accounts({
      initializer: provider.wallet.publicKey,
      tokenConfig: pdas.tokenConfig,
      mintAuthority: pdas.mintAuthority,
      mint: mint.publicKey,
      canMint: pdas.canMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([mint])
    .rpc();
  
  console.log("Initialization transaction signature", tx);
  console.log("============= Initializing secondary and third accounts ============="); 
  
  try {
    // Initialize blacklist account
    await program.methods
      .initializeSecondary()
      .accounts({
        initializer: provider.wallet.publicKey,
        mint: mint.publicKey,
        blacklist: pdas.blacklist,
        canForward: pdas.canForward,
        trustedContracts: pdas.trustedContracts,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Initialize canMint account
    await program.methods
      .initializeThird()
      .accounts({
        initializer: provider.wallet.publicKey,
        mint: mint.publicKey,
        internalWhitelist: pdas.internalWhitelist,
        externalWhitelist: pdas.externalWhitelist,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("All accounts initialized successfully");
  } catch (error) {
    console.error("Error initializing accounts:", error);
    throw error;
  }
}


/**
 * Setup token accounts for users
 * @param provider - The Anchor provider
 * @param users - Array of user keypairs
 * @param mint - The mint public key
 * @returns Array of token accounts
 */
export async function setupUserAccounts(
  provider: anchor.AnchorProvider,
  users: Keypair[],
  mint: PublicKey
): Promise<PublicKey[]> {
  const tokenAccounts: PublicKey[] = [];
  
  for (const user of users) {
    const tokenAccount = await createTokenAccountIfNeeded(provider, user, mint);
    tokenAccounts.push(tokenAccount);
  }
  
  return tokenAccounts;
}