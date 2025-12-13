import { Ed25519Program, PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import * as anchor from "@coral-xyz/anchor";
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';

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
  const tokenAccount = await getAssociatedTokenAddress(
    mintPubkey,
    owner.publicKey
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
      mintPubkey
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
  blacklist: PublicKey;
  canMint: PublicKey;
  canForward: PublicKey;
  trustedContracts: PublicKey;
  internalWhitelist: PublicKey;
  externalWhitelist: PublicKey;
}

/**
 * Calculates all PDAs for a token
 * @param mint - The mint public key
 * @param programId - The program ID
 * @returns Object containing all PDAs
 */
export function calculatePDAs(mint: PublicKey, programId: PublicKey): TokenPDAs {
  const [tokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("token-config"), mint.toBuffer()],
    programId
  );

  const [mintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority"), mint.toBuffer()],
    programId
  );

  const [blacklist] = PublicKey.findProgramAddressSync(
    [Buffer.from("blacklist"), mint.toBuffer()],
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

  const [internalWhitelist] = PublicKey.findProgramAddressSync(
    [Buffer.from("internal-whitelist"), mint.toBuffer()],
    programId
  );

  const [externalWhitelist] = PublicKey.findProgramAddressSync(
    [Buffer.from("external-whitelist"), mint.toBuffer()],
    programId
  );





  return {
    tokenConfig,
    mintAuthority,
    blacklist,
    canMint,
    canForward,
    trustedContracts,
    internalWhitelist,
    externalWhitelist
  };
}


export function stringToUint8Array(input: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(input);
}


// Helper function to format messages with nonces
export function formatMessage(action: string, amount: string, nonce: number): string {
  return `${action}:${amount}:${nonce}`;
}



export async function getCurrentNonce(
  user: Keypair,
  pdas: TokenPDAs,
  program: any
): Promise<number> {
  // Derive the UserNonce PDA for this forwarder + canForward
  const [userNoncePda] = await PublicKey.findProgramAddressSync(
    [
      Buffer.from("user-nonce"),
       user.publicKey.toBuffer(),
      pdas.canForward.toBuffer(),
    ],
    program.programId
  );
  console.log("User nonce PDA getcurrentNonce:", userNoncePda.toBase58());
  // Fetch the UserNonce account
  const userNonceAccount = await program.account.userNonce.fetch(userNoncePda);
if (userNonceAccount === null) {
  
}
  console.log("User nonce:", userNonceAccount.nonce);
  return userNonceAccount.nonce;
}


// Helper function to create an Ed25519 signature for a message with proper nonce
export async function createSignedMessageWithNonce(
  action: string,
  amount: string,
  signer: Keypair,
  forwarder: Keypair,
  pdas: TokenPDAs,
  program: any,
  incrementNonce: boolean
): Promise<{ message: Uint8Array; ed25519Ix: any; signature: Uint8Array<ArrayBufferLike>; nonce: number }> {
  // Get the current nonce and increment it
  const currentNonce = await getCurrentNonce(signer, pdas, program);

  const newNonce = incrementNonce ? currentNonce + 1 : currentNonce;

  // Format the message with the new nonce
  const messageString = formatMessage(
    action,
    amount,
    newNonce
  );

  // Convert to Uint8Array and sign
  const messageBytes = stringToUint8Array(messageString);
  const signature = nacl.sign.detached(messageBytes, signer.secretKey);
  console.log("=========Creating Ed25519 Instruction==========");
  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: signer.publicKey.toBuffer(),
    message: messageBytes,
    signature: signature,
  });
  return {
    message: messageBytes,
    ed25519Ix: ed25519Ix,
    signature: signature,
    nonce: newNonce
  };
}

export function bytesToHexString(bytes) {
  return Buffer.from(bytes).toString('hex');
}


export async function calculateUserNoncePDA(user: any, pdas: TokenPDAs, program: any):Promise<any> {
  const [userNoncePDA, bump] = await PublicKey.findProgramAddressSync(
    [
      Buffer.from("user-nonce"),
      user.publicKey.toBuffer(),
      pdas.canForward.toBuffer()
    ],
    program.programId
  );

  await program.methods
    .initializeUserNonce()
    .accounts({
      user: user.publicKey,
      canForward: pdas.canForward,
      userNonce: userNoncePDA,
      tokenConfig: pdas.tokenConfig,
      systemProgram: SystemProgram.programId,
    })
    .signers([user])
    .rpc();

    return userNoncePDA
}