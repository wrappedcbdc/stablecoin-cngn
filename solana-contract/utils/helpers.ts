import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import * as anchor from "@coral-xyz/anchor";
import { Keypair } from '@solana/web3.js';

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


export  function stringToUint8Array(input: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(input);
}
