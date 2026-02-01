import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } from '@solana/web3.js';
import { createMint, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from "@coral-xyz/anchor";

import fs from "fs";
import path from "path";
import { createTokenAccountIfNeeded, TokenPDAs } from './helpers';
import { createMintAccountWithExtensions } from '../app/utils/metadata2022';


/**
 * Token parameters configuration
 */
export const TOKEN_PARAMS = {
  name: "cNGN",
  symbol: "cNGN",
  decimals: 9,
  uri: "helper",
  mintAmount: new anchor.BN(100000_000_000_000), // 10,000 tokens with 6 decimals
  transferAmount: new anchor.BN(5000_000_000_000), // 5,000 tokens
  partialAmount: new anchor.BN(2_500_000_000_000) // 2,500 tokens
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
 // Use target/deploy folder where Anchor stores program keypairs
  const filePath = path.join(process.cwd(), "target/deploy/cngn-keypair.json");

  // Load program keypair
  let programKeyPair: Keypair;
  
  if (fs.existsSync(filePath)) {
    console.log("Loading program keypair from:", filePath);
    const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    programKeyPair = Keypair.fromSecretKey(Uint8Array.from(json));
  } else {
    throw new Error(`Program keypair not found at ${filePath}. Please run 'anchor build' first.`);
  }

  console.log("Program Public Key:", programKeyPair.publicKey.toBase58());

  // Execute the initialization transaction
  const tx = await program.methods
    .initialize(TOKEN_PARAMS.name, TOKEN_PARAMS.symbol, TOKEN_PARAMS.uri, TOKEN_PARAMS.decimals)
    .accounts({
      initializer: provider.wallet.publicKey,
      program: programKeyPair.publicKey,
      tokenConfig: pdas.tokenConfig,
      admin: admin,
      mintAuthority: pdas.mintAuthority,
      mint: mint.publicKey,
      //extraMetasAccount: pdas.extraMetasAccount,
      canMint: pdas.canMint,
      tokenProgram: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"), // TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([programKeyPair])
    .rpc();

  console.log("Initialization transaction signature", tx);


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
    console.log(" Multisig initialization transaction signature", tx);

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

