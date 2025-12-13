import * as anchor from '@coral-xyz/anchor';
import { Keypair, SystemProgram, PublicKey } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  TYPE_SIZE,
  LENGTH_SIZE,
  ExtensionType,
  createInitializePermanentDelegateInstruction,
  createInitializeTransferHookInstruction,
} from '@solana/spl-token';
import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from '@solana/spl-token-metadata';

interface TokenParams {
  name: string;
  symbol: string;
  uri: string;
  decimals?: number;
}

// Step 1: Create the mint with ALL extensions matching your Rust code
export async function createMintAccountWithExtensions(
  provider: anchor.AnchorProvider,
  mint: Keypair,
  params: TokenParams,
  programId: PublicKey // Your Anchor program ID for transfer hook
): Promise<string> {
  const payer = (provider.wallet as anchor.Wallet).payer;
  const decimals = params.decimals ?? 6;

  // Calculate space for mint with ALL extensions
  const extensions = [
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
   // ExtensionType.TransferHook,
  ];
  
  const mintLen = getMintLen(extensions);
  
  // Add space for metadata
  const metadata: TokenMetadata = {
    mint: mint.publicKey,
    name: params.name,
    symbol: params.symbol,
    uri: params.uri,
    additionalMetadata: [
      
    ],
  };
  
  const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
  const metadataLen = pack(metadata).length;
  
  const lamports = await provider.connection.getMinimumBalanceForRentExemption(
    mintLen + metadataExtension + metadataLen
  );

  console.log('📦 Creating mint account with extensions...');
  console.log(`   Mint: ${mint.publicKey.toString()}`);
  console.log(`   Space needed: ${mintLen + metadataExtension + metadataLen} bytes`);
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
      payer.publicKey, // Will be the permanent delegate initially
      TOKEN_2022_PROGRAM_ID
    ),
    
    // // 3. Initialize Transfer Hook extension
    // createInitializeTransferHookInstruction(
    //   mint.publicKey,
    //   payer.publicKey, // Authority
    //   programId, // Your Anchor program that handles the hook
    //   TOKEN_2022_PROGRAM_ID
    // ),
    
    // 4. Initialize Metadata Pointer extension
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      payer.publicKey, // Update authority
      mint.publicKey, // Metadata stored on mint itself
      TOKEN_2022_PROGRAM_ID
    ),
    
    // 5. Initialize the mint itself
    createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      payer.publicKey, // Mint authority (temporary, will be transferred)
      payer.publicKey, // Freeze authority (temporary, will be transferred)
      TOKEN_2022_PROGRAM_ID
    ),
    
    // 6. Initialize metadata
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: mint.publicKey,
      updateAuthority: payer.publicKey,
      mint: mint.publicKey,
      mintAuthority: payer.publicKey,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
    })
  );

  const signature = await provider.sendAndConfirm(transaction, [payer, mint]);

  console.log('✅ Mint account created with all extensions!');
  console.log(`   Transaction: ${signature}\n`);

  return signature;
}
