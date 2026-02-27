
import * as anchor from "@coral-xyz/anchor";

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction
} from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  createInitializePermanentDelegateInstruction,
  ExtensionType,
  getMintLen,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAccountLen,
  createInitializeAccountInstruction,
  createInitializeInstruction,
  TYPE_SIZE,
  LENGTH_SIZE,
  createInitializeMetadataPointerInstruction
} from "@solana/spl-token";
import { extension, getInitializeAccountInstruction } from "@solana-program/token-2022";
import { getSignatureFromTransaction } from "@solana/kit";
import { TOKEN_PARAMS } from "./token_initializer";

import {
  pack,
  TokenMetadata,
} from '@solana/spl-token-metadata';
import { createEd25519Instruction, sign } from "../app/admin/multisig/helpers";

 export const TEST_TOKEN_PARAMS:TokenParams  = {
    name: "cNGN",
    symbol: "cNGN",
    decimals: 9,
    uri: "helper",
    mintAmount: new anchor.BN(1000000_000_000_000) // 1,000,000,000 tokens with 9 decimals
  };



/**
 * Creates a token account for the specified owner if it doesn't already exist
 * @param provider - The Anchor provider
 * @param owner - The account owner
 * @param mintPubkey - The mint public key
 * @returns The token account public key
 */
export async function createTokenAccountIfNeeded(
  provider: anchor.AnchorProvider,
  owner: Keypair,
  mintPubkey: PublicKey
): Promise<PublicKey> {
  const tokenAccount = await getAssociatedTokenAddressSync(
    mintPubkey,
    owner.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  try {
    await getAccount(provider.connection, tokenAccount);
    console.log("Token account already exists");
  } catch (error) {
    console.log(`Creating token account for ${owner.publicKey.toString().slice(0, 8)}...`);
    const createATAIx = createAssociatedTokenAccountInstruction(
      provider.wallet.publicKey,
      tokenAccount,
      owner.publicKey,
      mintPubkey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const ataTx = new anchor.web3.Transaction().add(createATAIx);
    await provider.sendAndConfirm(ataTx);
  }

  return tokenAccount;
}

/**
 * Interface for token PDAs
 */
export interface TokenPDAs {
  tokenConfig: PublicKey;
  mintAuthority: PublicKey;
  canMint: PublicKey;
  canForward: PublicKey;
  trustedContracts: PublicKey;
  multisig: PublicKey;
}

/**
 * Calculates all PDAs for a token
 * @param mint - The mint public key
 * @param programId - The program ID
 * @returns Object containing all PDAs
 */
export function calculatePDAs(mint: PublicKey, programId: PublicKey): TokenPDAs {
  const [tokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("token-config")],
    programId
  );

  const [mintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority"), mint.toBuffer()],
    programId
  );

  const [canMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("can-mint"), mint.toBuffer()],
    programId
  );

  const [canForward] = PublicKey.findProgramAddressSync(
    [Buffer.from("can-forward"), mint.toBuffer()],
    programId
  );

  const [trustedContracts] = PublicKey.findProgramAddressSync(
    [Buffer.from("trusted-contracts"), mint.toBuffer()],
    programId
  );





  const [multisig] = PublicKey.findProgramAddressSync(
    [Buffer.from("multisig"), mint.toBuffer()],
    programId
  );

  return {
    tokenConfig,
    mintAuthority,
    canMint,
    canForward,
    trustedContracts,
    multisig
  };
}

export function stringToUint8Array(input: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(input);
}
export interface TokenParams {
  name: string;
  symbol: string;
  uri: string;
  decimals?: number;
   mintAmount?: anchor.BN
}


export async function createMintAccountWithExtensions(
  provider: anchor.AnchorProvider,
  mint: Keypair,
  params: TokenParams,
  authority: PublicKey,
  permanentDelegate: PublicKey,

): Promise<string> {
  const payer = (provider.wallet as anchor.Wallet).payer;
  const decimals = params.decimals ?? 6;

  // Calculate space for mint with permanent delegate extension only
  const extensions = [
    ExtensionType.PermanentDelegate,
  ];

  const mintLen = getMintLen(extensions);

  const lamports = await provider.connection.getMinimumBalanceForRentExemption(
    mintLen
  );

  console.log('📦 Creating mint account with permanent delegate...');
  console.log(`   Mint: ${mint.publicKey.toString()}`);
  console.log(`   Space needed: ${mintLen} bytes`);
  console.log(`   Rent: ${lamports / anchor.web3.LAMPORTS_PER_SOL} SOL\n`);

  const transaction = new anchor.web3.Transaction().add(
    // 1. Create mint account
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),

    // 2. Initialize Permanent Delegate extension
    createInitializePermanentDelegateInstruction(
      mint.publicKey,
      permanentDelegate, // Will be the permanent delegate initially
      TOKEN_2022_PROGRAM_ID
    ),

    // 3. Initialize the mint itself
    createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      authority, // Mint authority (temporary, will be transferred)
      permanentDelegate, // Freeze authority (temporary, will be transferred)
      TOKEN_2022_PROGRAM_ID
    )
  );

  const signature = await provider.sendAndConfirm(transaction, [payer, mint]);

  console.log('✅ Mint account created with permanent delegate!');
  console.log(`   Transaction: ${signature}\n`);

  return signature;
}


export const Cngnparams = {
  name: "CNGN",
  symbol: "cNGN",
  uri: "https://aqua-changing-meadowlark-684.mypinata.cloud/ipfs/bafkreiesa7z3kyazntetn6ce257tax4wipnlx6ss3ahajpn5l7f33rwfsy", 
  sellerFeeBasisPoints: 0,
  creators: null,
  collection: null,
  uses: null,
  description: "cNGN is Nigeria’s first regulated stablecoin, pegged 1:1 to the Nigerian Naira and fully backed by naira reserves held in licensed commercial banks.",
};



/**
* Build and send a multisig transaction
*/
export async function buildAndSendMultisigTransaction(
  provider: anchor.AnchorProvider,
  signers: Keypair[],
  message: Buffer,
  instruction: TransactionInstruction
): Promise<string> {
  console.log("\n=== Building Transaction ===");
  console.log("Message hash:", message.toString("hex"));

  // Create Ed25519 signature instructions
  const ed25519Instructions: TransactionInstruction[] = [];
  for (const signer of signers) {
    const { signature, address } = sign(signer, message);
    console.log(`Signature from ${signer.publicKey}:`, signature.slice(0, 16).toString() + '...');
    ed25519Instructions.push(createEd25519Instruction(address, message, signature));
  }

  // Build transaction
  const tx = new Transaction();
  ed25519Instructions.forEach((ix) => tx.add(ix));
  tx.add(instruction);

  const { blockhash } = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = provider.wallet.publicKey;

  console.log("\n=== Sending Transaction ===");
  console.log("Instructions:", tx.instructions.length);
  console.log("  -", ed25519Instructions.length, "Ed25519 signature instructions");
  console.log("  - 1 main instruction");

  // Send and confirm
  const signature = await provider.sendAndConfirm(tx, [], {
    skipPreflight: false,
    commitment: "confirmed",
  });

  console.log("\n✓ Transaction confirmed!");
  console.log("Signature:", signature);
  console.log(
    `View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`
  );

  return signature;
}