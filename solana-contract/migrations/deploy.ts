import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { calculatePDAs, Cngnparams, TokenPDAs } from '../utils/helpers';
import { initializeMultisig, initializeToken } from '../utils/token_initializer';
import { loadOrCreateKeypair } from '../app/utils/helpers';
import { createMintAccountWithExtensions } from '../app/utils/metadata2022';
import { createSPLMultisig } from '../app/admin/spl_multisig';
import { transferMintAuthority } from '../utils/transfer_mint_authority';
import cngnidl from '../target/idl/cngn.json';
import fs from 'fs';
import { transferFreezeAuthority } from '../utils/transfer_freeze_authority';
require('dotenv').config();

const { web3 } = anchor;

/**
 * Deployment Authority Flow
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Step 1 — Create SPL native multisig
 *   A standard SPL multisig account is created with the configured owners and
 *   threshold. This multisig will be assigned as the mint's permanentDelegate,
 *   giving it exclusive authority to burn tokens via destroyBlackFunds.
 *
 * Step 2 — Create Token-2022 mint with extensions
 *   The mint is created with the following authority assignments:
 *     permanentDelegate    → splMultisig        (SPL multisig — authorises burns)
 *     mintAuthority        → payer              (temporarily held by deployer)
 *     freezeAuthority      → pdas.mintAuthority (Anchor PDA — never changes)
 *     metadataUpdateAuth   → pdas.mintAuthority (Anchor PDA — never changes)
 *
 * Step 3 — Transfer mint authority to the Anchor PDA
 *   mintAuthority is transferred from the deployer wallet to pdas.mintAuthority
 *   so that all future minting is exclusively controlled by the Anchor program.
 *   After this point no wallet can mint directly.
 *
 * Step 4 — Initialise Anchor program state
 *   initializeToken reads the existing mint and sets up tokenConfig + all role
 *   PDAs (canMint, blacklist, etc.). The mint authority is already the PDA, so
 *   the program can CPI into Token-2022 to mint immediately.
 *
 * Step 5 — Initialise Anchor multisig PDA
 *   A separate on-chain multisig PDA (distinct from the SPL multisig in Step 1)
 *   is created to store owners, threshold, and nonce. The Anchor program checks
 *   this PDA to authorise privileged instructions such as addCanMint, blacklist,
 *   and changeAdmin.
 *
 * Post-deployment
 *   • Rotate admin from deployer wallet → governance key via changeAdmin()
 *   • Verify all PDAs on-chain with the verification script
 *   • Confirm mintAuthority   = pdas.mintAuthority  via getMint()
 *   • Confirm permanentDelegate = splMultisig        via getExtensionData()
 */
async function main() {
  // ── Provider ──────────────────────────────────────────────────────────────
  const connection = new web3.Connection(
    process.env.RPC_URL ?? 'https://api.mainnet.solana.com',
    'confirmed',
  );
  const provider = new anchor.AnchorProvider(connection, anchor.Wallet.local());
  anchor.setProvider(provider);

  const payer = (provider.wallet as anchor.Wallet).payer;
  const program = new anchor.Program(cngnidl as anchor.Idl, provider);
  console.log('Program ID:', program.programId.toBase58());

  // ── Keypairs ──────────────────────────────────────────────────────────────
  const cngnMintKeypair = await loadOrCreateKeypair('cngnMint');
  console.log('Mint:', cngnMintKeypair.publicKey.toString());

  // ── PDAs ──────────────────────────────────────────────────────────────────
  const pdas: TokenPDAs = calculatePDAs(cngnMintKeypair.publicKey, program.programId);
  console.log('mintAuthority PDA:', pdas.mintAuthority.toString());
  console.log('multisig PDA:     ', pdas.multisig.toString());

  // ── Multisig owners ───────────────────────────────────────────────────────
  if (!process.env.SIGNER_1 || !process.env.SIGNER_2) {
    throw new Error('SIGNER_1 and SIGNER_2 must be set in .env');
  }
  const multisigOwners = [
    new PublicKey(process.env.SIGNER_1),
    new PublicKey(process.env.SIGNER_2),
  ];
  const threshold = 2;
  console.log('Multisig owners:', multisigOwners.map(k => k.toString()));

  // ── Deployment ────────────────────────────────────────────────────────────
  try {
    // ── Step 1: Create SPL native multisig ───────────────────────────────
    // Produces an SPL multisig account that will be assigned as the mint's
    // permanentDelegate, authorising it to burn tokens via destroyBlackFunds.
    console.log('\n--- Step 1: Creating SPL multisig ---');
    const splMultisig = await createSPLMultisig(
      provider,
      payer,
      multisigOwners,
      threshold,
    );
    console.log('SPL multisig:', splMultisig.toString());

    // ── Step 2: Create Token-2022 mint with extensions ────────────────────
    // Mint is created with:
    //   permanentDelegate  → splMultisig        (SPL multisig — authorises burns)
    //   mintAuthority      → payer              (temporary; transferred in Step 3)
    //   freezeAuthority    → pdas.mintAuthority (Anchor PDA — permanent)
    //   metadataUpdateAuth → pdas.mintAuthority (Anchor PDA — permanent)
    console.log('\n--- Step 2: Creating Token-2022 mint with extensions ---');
    await createMintAccountWithExtensions(
      provider,
      cngnMintKeypair,
      Cngnparams,
      splMultisig,       // permanentDelegate → SPL multisig
      payer.publicKey,   // mintAuthority     → deployer (temporary)
    );

    // ── Step 3: Transfer mint authority to the Anchor PDA ─────────────────
    // Moves mintAuthority from the deployer wallet to pdas.mintAuthority so
    // that all future minting is exclusively gated by the Anchor program.
    // No wallet will be able to mint directly after this transfer.
    console.log('\n--- Step 3: Transferring mint authority to Anchor PDA ---');
    await transferMintAuthority(
      pdas.mintAuthority,
      cngnMintKeypair.publicKey,
      payer,
      provider.connection,
    );

        await transferFreezeAuthority(
      splMultisig,
      cngnMintKeypair.publicKey,
      payer,
      provider.connection,
    );


    // ── Step 4: Initialise Anchor program state ───────────────────────────
    // Sets up tokenConfig, canMint, and all role PDAs against the existing
    // mint. Because mintAuthority is already pdas.mintAuthority the program
    // can CPI into Token-2022 to mint without any further authority transfers.
    console.log('\n--- Step 4: Initialising Anchor program state ---');
    await initializeToken(
      program,
      provider,
      cngnMintKeypair,
      pdas,
      payer.publicKey, // initial admin — rotate to governance key via changeAdmin()
    );

    // ── Step 5: Initialise Anchor multisig PDA ────────────────────────────
    // Creates the on-chain multisig PDA storing owners, threshold, and nonce.
    // This is distinct from the SPL multisig in Step 1 and is what the Anchor
    // program checks to authorise privileged instructions (addCanMint, etc.).
    console.log('\n--- Step 5: Initialising Anchor multisig PDA ---');
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

    const deploymentOutput = {
      programId:  program.programId.toBase58(),
      mint:       cngnMintKeypair.publicKey.toBase58(),
      pdas: {
        mintAuthority: pdas.mintAuthority.toBase58(),
        multisig:      pdas.multisig.toBase58(),
      },
      multisigs: {
        splMultisig: splMultisig.toBase58(),
      },
      roles: {
        permanentDelegate:       splMultisig.toBase58(),
        mintAuthority:           pdas.mintAuthority.toBase58(),
        freezeAuthority:         pdas.mintAuthority.toBase58(),
        metadataUpdateAuthority: pdas.mintAuthority.toBase58(),
      },
      config: {
        threshold,
        owners: multisigOwners.map(o => o.toBase58()),
      },
      timestamp: new Date().toISOString(),
    };

    const outputPath = './deployment-output.json';
    fs.writeFileSync(outputPath, JSON.stringify(deploymentOutput, null, 2));

    console.log(`\n📄 Deployment addresses written → ${outputPath}`);
    console.log('   Mint:               ', cngnMintKeypair.publicKey.toString());
    console.log('   mintAuthority PDA:  ', pdas.mintAuthority.toString());
    console.log('   Anchor multisig PDA:', pdas.multisig.toString());
    console.log('   SPL multisig:       ', splMultisig.toString());
    console.log('   permanentDelegate:  ', splMultisig.toString());
    console.log('\n⚠️  Next steps:');
    console.log('   1. Rotate admin → governance key via changeAdmin()');
    console.log('   2. Verify all PDAs on-chain with the verification script');
    console.log('   3. Confirm mintAuthority    = pdas.mintAuthority via getMint()');
    console.log('   4. Confirm permanentDelegate = splMultisig        via getExtensionData()');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:  ', error.stack);
    } else {
      console.error('Unknown error:', JSON.stringify(error, null, 2));
    }
    process.exit(1);
  }
}

main().then(
  () => process.exit(0),
  err => {
    console.error(err);
    process.exit(1);
  },
);