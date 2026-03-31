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

/**
 * Creates a Token-2022 mint with:
 *   - PermanentDelegate extension  → permanentDelegate (SPL multisig)
 *   - MetadataPointer extension    → points to the mint itself
 *   - On-mint metadata             → name / symbol / uri
 *
 * Authority assignments (FINAL — no transfers needed after this):
 *   mintAuthority      = mintAuthority param  (Anchor PDA pdas.mintAuthority)
 *   freezeAuthority    = mintAuthority param  (Anchor PDA pdas.mintAuthority)
 *   metadataUpdateAuth = mintAuthority param  (Anchor PDA pdas.mintAuthority)
 *   permanentDelegate  = permanentDelegate param (SPL native multisig)
 *
 * No TransferHook extension — removed per deployment requirements.
 *
 * INSTRUCTION ORDER (matters for Token-2022):
 *   1. createAccount
 *   2. initializePermanentDelegate   ← must come before initializeMint
 *   3. initializeMetadataPointer     ← must come before initializeMint
 *   4. initializeMint
 *   5. initializeMetadata            ← must come after initializeMint
 */
export async function createMintAccountWithExtensions(
  provider: anchor.AnchorProvider,
  mint: Keypair,
  params: TokenParams,
  permanentDelegate: PublicKey,
  mintAuthority: PublicKey,
): Promise<string> {
  const payer = (provider.wallet as anchor.Wallet).payer;
  const decimals = params.decimals ?? 6;

  // ── Space calculation ──────────────────────────────────────────────────────
  // getMintLen only accounts for the fixed extension headers.
  // Metadata lives after the mint data and is sized separately.
  const extensions = [
    ExtensionType.PermanentDelegate,
    ExtensionType.MetadataPointer,
  ];
  const mintLen = getMintLen(extensions);

  const metadata: TokenMetadata = {
    mint: mint.publicKey,
    name: params.name,
    symbol: params.symbol,
    uri: params.uri,
    additionalMetadata: [],
  };

  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const totalSpace = mintLen + metadataLen;

  const lamports = await provider.connection.getMinimumBalanceForRentExemption(totalSpace);

  console.log('📦 Creating Token-2022 mint...');
  console.log('   Mint:              ', mint.publicKey.toString());
  console.log('   mintAuthority:     ', mintAuthority.toString());
  console.log('   freezeAuthority:   ', mintAuthority.toString());
  console.log('   permanentDelegate: ', permanentDelegate.toString());
  console.log('   Space:             ', totalSpace, 'bytes');
  console.log('   Rent:              ', lamports / anchor.web3.LAMPORTS_PER_SOL, 'SOL');

  const transaction = new anchor.web3.Transaction().add(
    // ── 1. Allocate account ──────────────────────────────────────────────────
    // Space is mintLen only — Token-2022 reallocates for metadata in step 5.
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),

    // ── 2. PermanentDelegate ─────────────────────────────────────────────────
    // Must be initialized before initializeMint.
    // Set to SPL multisig — this account must sign burn/transfer calls
    // that use the delegate authority (i.e. destroyBlackFunds).
    createInitializePermanentDelegateInstruction(
      mint.publicKey,
      permanentDelegate,
      TOKEN_2022_PROGRAM_ID,
    ),

    // ── 3. MetadataPointer ───────────────────────────────────────────────────
    // Must be initialized before initializeMint.
    // Points metadata storage at the mint account itself (no separate account).
    // Update authority = mintAuthority PDA so the Anchor program can update it.
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      mintAuthority,   // update authority for metadata
      mint.publicKey,  // metadata lives on the mint account itself
      TOKEN_2022_PROGRAM_ID,
    ),

    // ── 4. Initialize mint ───────────────────────────────────────────────────
    // Both mint and freeze authority are set to the Anchor PDA permanently.
    // The Anchor program controls minting via CPI. No authority transfer needed.
    createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      mintAuthority,  // mintAuthority  = pdas.mintAuthority (Anchor PDA)
      mintAuthority,  // freezeAuthority = pdas.mintAuthority (Anchor PDA)
      TOKEN_2022_PROGRAM_ID,
    ),

    // ── 5. Initialize metadata ───────────────────────────────────────────────
    // Must come after initializeMint. Token-2022 reallocates the account
    // to fit the metadata at this point.
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: mint.publicKey,
      updateAuthority: mintAuthority,
      mint: mint.publicKey,
      mintAuthority: mintAuthority,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
    }),
  );

  const signature = await provider.sendAndConfirm(transaction, [payer, mint]);

  console.log('✅ Mint created');
  console.log('   Signature:', signature);

  return signature;
}