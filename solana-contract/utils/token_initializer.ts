import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } from '@solana/web3.js';
import { createMint, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from "@coral-xyz/anchor";

import { createTokenAccountIfNeeded, TokenPDAs } from './helpers';
import { createMintAccountWithExtensions } from '../app/utils/metadata2022';


/**
 * Token parameters configuration
 */
export const TOKEN_PARAMS = {
  name: "cNGN",
  symbol: "cNGN",
  decimals: 6,
  uri: "helper",
  mintAmount: new anchor.BN(100_000_000), // 10,000 tokens with 6 decimals
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
  pdas: TokenPDAs,
  admin: PublicKey,

): Promise<void> {
  console.log("=========== Initializing token ========");
  //await createMintAccountWithExtensions(provider, mint, TOKEN_PARAMS, program.programId);
  //await createMint(provider.connection,provider.wallet.payer,provider.wallet.payer.publicKey,
  //provider.wallet.payer.publicKey, TOKEN_PARAMS.decimals,mint,null,TOKEN_2022_PROGRAM_ID);
  // Execute the initialization transaction
  const tx = await program.methods
    .initialize(TOKEN_PARAMS.name, TOKEN_PARAMS.symbol, TOKEN_PARAMS.uri, TOKEN_PARAMS.decimals)
    .accounts({
      initializer: provider.wallet.publicKey,
      tokenConfig: pdas.tokenConfig,
      admin: admin,
      mintAuthority: pdas.mintAuthority,
      mint: mint.publicKey,
      extraMetasAccount: pdas.extraMetasAccount,
      canMint: pdas.canMint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  console.log("Initialization transaction signature", tx);
  console.log("============= Initializing secondary and third accounts =============");

  try {
    // Initialize secondary accounts (blacklist, canForward, trustedContracts)
    const tx2 = await program.methods
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

    console.log("Secondary initialization transaction signature", tx2);

    // Initialize third accounts (whitelists and extra metas)
    const tx3 = await program.methods
      .initializeThird()
      .accounts({
        initializer: provider.wallet.publicKey,
        mint: mint.publicKey,
        extraMetasAccount: pdas.extraMetasAccount,
        tokenConfig: pdas.tokenConfig,
        internalWhitelist: pdas.internalWhitelist,
        externalWhitelist: pdas.externalWhitelist,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Third initialization transaction signature", tx3);
    console.log("All accounts initialized successfully");
  } catch (error) {
    console.error("Error initializing accounts:", error);
    throw error;
  }
}

export async function initializeMultisig(
  program: any,
  provider: anchor.AnchorProvider,
  mint: Keypair,
  pdas: TokenPDAs,
  owners: any,
  threshold: Number
) {

  try {
    let tx = await program.methods
      .initializeMultisig(
        owners,
        threshold
      )
      .accounts({
        multisig: pdas.multisig,
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        payer: provider.wallet.payer.publicKey,
        systemProgram: SystemProgram.programId
      })
      .rpc();
    console.log("Multisig initialization transaction signature", tx);

  } catch (error) {
    console.log("error creating multisig", error)
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