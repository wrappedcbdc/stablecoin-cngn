import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { calculatePDAs, Cngnparams, TokenPDAs } from '../utils/helpers';
import { initializeMultisig, initializeToken } from '../utils/token_initializer';
import { loadOrCreateKeypair } from '../app/utils/helpers';
import { createMintAccountWithExtensions, } from '../app/utils/metadata2022';
import { createSPLMultisig } from '../app/admin/spl_multisig';
import cngnidl from '../target/idl/cngn.json';
require('dotenv').config();

const { web3 } = anchor;

/**
 * Authority flow:
 *
 *  createMintAccountWithExtensions
 *    permanentDelegate  → splMultisig   (SPL multisig — controls destroyBlackFunds)
 *    mintAuthority      → pdas.mintAuthority  (Anchor PDA — controls minting via program)
 *    freezeAuthority    → pdas.mintAuthority  (same PDA for now; transfer to multisig post-init if needed)
 *    metadataUpdateAuth → pdas.mintAuthority  (PDA)
 *
 *  initializeToken (Anchor instruction)
 *    Reads the existing mint, sets up tokenConfig + all PDAs.
 *    Does NOT re-set mint authority — PDA already owns it.
 *
 *  initializeMultisig (Anchor instruction)
 *    Creates the on-chain multisig PDA with owners + threshold.
 *
 *  NO transferMintAuthority / transferFreezeAuthority calls needed.
 *  The PDA is already the authority from mint creation.
 */
async function main() {
  // ── Provider ──────────────────────────────────────────────────────────────
  const connection = new web3.Connection(
    process.env.RPC_URL ?? 'https://api.devnet.solana.com',
    'confirmed',
  );
  const provider = new anchor.AnchorProvider(connection, anchor.Wallet.local());
  anchor.setProvider(provider);

  const payer = (provider.wallet as anchor.Wallet).payer;
  const program = new anchor.Program(cngnidl as anchor.Idl, provider);
  console.log('Program ID:', program.programId.toBase58());

  // ── Keypairs ──────────────────────────────────────────────────────────────
  const cngnMintKeypair = await loadOrCreateKeypair('cngnMint');
  const splMultisigKeypair = await loadOrCreateKeypair('splMultisig');
  console.log('Mint:', cngnMintKeypair.publicKey.toString());

  // ── PDAs ──────────────────────────────────────────────────────────────────
  const pdas: TokenPDAs = calculatePDAs(cngnMintKeypair.publicKey, program.programId);
  console.log('mintAuthority PDA:', pdas.mintAuthority.toString());
  console.log('multisig PDA:     ', pdas.multisig.toString());

  // ── Multisig owners ───────────────────────────────────────────────────────
  if (!process.env.SIGNER_1 || !process.env.SIGNER_2) {
    throw new Error('SIGNER_1 and SIGNER_2 must be set in .env');
  }
  const signer1 = new PublicKey(process.env.SIGNER_1);
  const signer2 = new PublicKey(process.env.SIGNER_2);
  const multisigOwners = [signer1, signer2];
  const threshold = 2;
  console.log('Multisig owners:', multisigOwners.map(k => k.toString()));

  // ── Deployment ────────────────────────────────────────────────────────────
  try {
    // ── Step 1: SPL native multisig (controls permanentDelegate burns) ──────
    console.log('\n--- Step 1: Creating SPL multisig ---');
    const splMultisig = await createSPLMultisig(
      provider,
      payer,
      splMultisigKeypair,
      multisigOwners,
      threshold,
    );
    console.log('SPL multisig:', splMultisig.toString());

    // ── Step 2: Create Token-2022 mint with extensions ────────────────────
    //
    //  Authority assignments at mint creation time:
    //  • permanentDelegate  = splMultisig        (SPL multisig signs burns)
    //  • mintAuthority      = pdas.mintAuthority (Anchor PDA — never changes)
    //  • freezeAuthority    = pdas.mintAuthority (Anchor PDA — never changes)
    //  • metadataUpdateAuth = pdas.mintAuthority (Anchor PDA)
    //
    //  Do NOT pass payer or deployer wallet as any authority.
    //  Do NOT call transferMintAuthority or transferFreezeAuthority after this.
    //
    console.log('\n--- Step 2: Creating mint with extensions ---');
    await createMintAccountWithExtensions(
      provider,
      cngnMintKeypair,
      Cngnparams,
      splMultisig,          // permanentDelegate → SPL multisig
      pdas.mintAuthority,   // mintAuthority     → Anchor PDA (final, no transfer needed)
    );

    // ── Step 3: Initialize Anchor program state ───────────────────────────
    //
    //  initializeToken sets up tokenConfig, canMint, and all role PDAs.
    //  It expects the mint to already exist (which it does after step 2).
    //  The mint authority on the SPL account is already pdas.mintAuthority
    //  so the Anchor program can CPI into Token-2022 to mint immediately.
    //
    console.log('\n--- Step 3: Initializing Anchor program state ---');
    await initializeToken(
      program,
      provider,
      cngnMintKeypair,
      pdas,
      payer.publicKey,  // deployer is initial admin; rotate via changeAdmin after launch
    );

    // ── Step 4: Initialize on-chain multisig (Anchor PDA) ────────────────
    //
    //  This is separate from the SPL multisig above.
    //  This PDA stores owners + threshold + nonce and is what the Anchor
    //  program checks for admin instructions (addCanMint, blacklist, etc.).
    //
    console.log('\n--- Step 4: Initializing Anchor multisig ---');
    await initializeMultisig(
      program,
      provider,
      cngnMintKeypair,
      pdas,
      multisigOwners,
      threshold,
    );

    // ── Done ──────────────────────────────────────────────────────────────
    console.log('\n✅ Deployment complete');
    console.log('   Mint:              ', cngnMintKeypair.publicKey.toString());
    console.log('   mintAuthority PDA: ', pdas.mintAuthority.toString());
    console.log('   Anchor multisig:   ', pdas.multisig.toString());
    console.log('   SPL multisig:      ', splMultisig.toString());
    console.log('   permanentDelegate: ', splMultisig.toString());
    console.log('\n⚠️  Next steps:');
    console.log('   1. Rotate admin from deployer wallet → governance key via changeAdmin()');
    console.log('   2. Verify all PDAs on-chain with the verification script');
    console.log('   3. Confirm mint authority = pdas.mintAuthority via getMint()');
    console.log('   4. Confirm permanent delegate = splMultisig via getExtensionData()');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.error('Unknown error:', JSON.stringify(error, null, 2));
    }
    process.exit(1);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
