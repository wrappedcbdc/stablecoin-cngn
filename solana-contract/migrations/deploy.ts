import * as anchor from '@coral-xyz/anchor';

import fs from 'fs';
import { Keypair, PublicKey, } from '@solana/web3.js';
import { calculatePDAs, TokenPDAs } from '../utils/helpers';
import { initializeMultisig, initializeToken } from '../utils/token_initializer';
import { transferMintAuthority } from '../utils/transfer_mint_authority';
import { loadOrCreateKeypair } from '../app/utils/helpers';
import { transferFreezeAuthority } from '../utils/transfer_freeze_authority';

import { createMintAccountWithExtensions } from '../app/utils/metadata2022';
import cngnidl from '../target/idl/cngn.json';
require('dotenv').config();

const { web3 } = anchor;

async function main() {
  const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");
  // Configure the connection to the cluster
  const provider = new anchor.AnchorProvider(
    connection,
    anchor.Wallet.local(),
  );
  anchor.setProvider(provider);
  const payer = (provider.wallet as anchor.Wallet).payer;
  const program = new anchor.Program(cngnidl, provider);
  console.log("Program ID: ", program.programId.toBase58());
  // Create the mint keypair - this will be the actual token
  const cngnMintKeypair = await loadOrCreateKeypair("cngnMint")
  console.log("Mint Keypair:", cngnMintKeypair.publicKey.toString());

  const upgradeAuthority = new PublicKey(process.env.UPGRADE_AUTHORITY);
  console.log("Upgrade Authority:", upgradeAuthority.toString());
  let pdas: TokenPDAs;

  // Calculate all PDAs for the token
  pdas = calculatePDAs(cngnMintKeypair.publicKey, program.programId);

  //multisg threshold
  const threshold=2
  const signer1=new PublicKey(process.env.SIGNER1)
  const signer2=new PublicKey(process.env.SIGNER2)
  console.log("signers are",signer1.toString(),signer2.toString())
  const multisgOwners= [signer1,signer2]
console.log("multisig",pdas.multisig.toString())
  try {
    console.log('Program ID: ', program.programId.toBase58());
    console.log("Wallet:", provider.wallet.publicKey.toString());
    console.log("Mint Keypair:", cngnMintKeypair.publicKey.toString());
    // Initialize the token


   // Step 2: Create token metadata
   console.log("\n--- Step 2: Creating token metadata ---");
    await createMintAccountWithExtensions(
      provider,
      cngnMintKeypair,
      Cngnparams,
      payer.publicKey, //permanent delegate
      payer.publicKey,//hook authority
      pdas.mintAuthority,//mint authority
      program.programId
    )
   await initializeToken(program, provider, cngnMintKeypair, pdas,payer.publicKey);
    await initializeMultisig(program,provider,cngnMintKeypair,pdas,multisgOwners,threshold)
   // await transferMintAuthority(multisig, cngnMintKeypair.publicKey, payer, connection)
   // await transferFreezeAuthority(multisig, cngnMintKeypair.publicKey, payer, connection)
  } catch (error) {
    console.error("Error during initialization:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error("Unknown error:", JSON.stringify(error, null, 2));
    }
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);

    export const Cngnparams = {
      name: "CNGN",
      symbol: "cNGN",
      uri: "https://aqua-changing-meadowlark-684.mypinata.cloud/ipfs/bafkreiesa7z3kyazntetn6ce257tax4wipnlx6ss3ahajpn5l7f33rwfsy", // You can update this with a JSON URI later
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
      description: "cNGN is Nigeria’s first regulated stablecoin, pegged 1:1 to the Nigerian Naira and fully backed by naira reserves held in licensed commercial banks.",
    };