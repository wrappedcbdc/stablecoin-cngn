import * as anchor from '@coral-xyz/anchor';
import * as mpl from "@metaplex-foundation/mpl-token-metadata";
import fs from 'fs';
import { Keypair, } from '@solana/web3.js';
import { calculatePDAs, TokenPDAs } from '../utils/helpers';
import { initializeToken } from '../utils/token_initializer';
import { transferMintAuthority } from '../utils/transfer_authority';


const { web3 } = anchor;

async function main() {
  const connection = new web3.Connection("http://api.devnet.solana.com", "confirmed");
  // Configure the connection to the cluster
  const provider = new anchor.AnchorProvider(
    connection,
    anchor.Wallet.local(),
  );
  anchor.setProvider(provider);
  const payer = (provider.wallet as anchor.Wallet).payer;
  const program = new anchor.Program(anchor.workspace.Cngn.idl, provider);

  // Create the mint keypair - this will be the actual token
  const mintKeypair = Keypair.generate();
  console.log("Mint Keypair:", mintKeypair.publicKey.toString());
  //Save the keypair to a file
  const keypairData = {
    publicKey: mintKeypair.publicKey.toString(),
    secretKey: Array.from(mintKeypair.secretKey)
  };
  fs.writeFileSync('mintKeypair.json', JSON.stringify(keypairData, null, 2));
  console.log("MintKeypair saved to 'mintKeypair.json'");

  //   Load the keypair from the saved file
  // const keypairData = JSON.parse(fs.readFileSync('mintKeypair.json', 'utf-8'));
  // const mintKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData.secretKey));

  let pdas: TokenPDAs;
  
  // Calculate all PDAs for the token
  pdas = calculatePDAs(mintKeypair.publicKey, program.programId);

  try {
    // Initialize the token
    await initializeToken(program, provider, mintKeypair, pdas);

    console.log('Program ID: ', program.programId.toBase58());
    console.log("Wallet:", provider.wallet.publicKey.toString());
    console.log("Mint Keypair:", mintKeypair.publicKey.toString());

    const INITIALIZE = true;
   
    // Step 2: Create token metadata
    console.log("\n--- Step 2: Creating token metadata ---");

    // Get the signer from provider
    
    const seed1 = Buffer.from(anchor.utils.bytes.utf8.encode("metadata"));
    const seed2 = Buffer.from(mpl.PROGRAM_ID.toBytes());
    const seed3 = Buffer.from(mintKeypair.publicKey.toBytes());
    const [metadataPDA, _bump] = web3.PublicKey.findProgramAddressSync([seed1, seed2, seed3], mpl.PROGRAM_ID);

    // Create metadata
    const dataV2 = {
      name: "CNGN Token",
      symbol: "CNGN",
      uri: "hello", // You can update this with a JSON URI later
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    };
    const accounts:mpl.CreateMetadataAccountV3InstructionAccounts = {
      metadata: metadataPDA,
      mint: mintKeypair.publicKey,
      mintAuthority:provider. wallet.publicKey,
      payer: provider.wallet.publicKey,
      updateAuthority:provider.wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
    }

    let ix;
    if (INITIALIZE) {
      const args: mpl.CreateMetadataAccountV3InstructionArgs = {
        createMetadataAccountArgsV3: {
          data: dataV2,
          isMutable: true,
          collectionDetails: null
        }
      };
      ix = mpl.createCreateMetadataAccountV3Instruction(accounts, args);
    } else {
      const args = {
        updateMetadataAccountArgsV2: {
          data: dataV2,
          isMutable: true,
          updateAuthority: provider.wallet.publicKey,
          primarySaleHappened: true
        }
      };
      ix = mpl.createUpdateMetadataAccountV2Instruction(accounts, args)
    }
    const tx = new web3.Transaction();
    tx.add(ix);

    const metadataTxSignature = await web3.sendAndConfirmTransaction(connection, tx, [payer]);

    console.log("Token metadata created:", metadataTxSignature);
    console.log("Token mint address:", mintKeypair.publicKey.toString());
    console.log("Explorer link:", `https://explorer.solana.com/address/${mintKeypair.publicKey.toString()}?cluster=devnet`);

   await transferMintAuthority(pdas.mintAuthority, mintKeypair.publicKey, payer, connection) 
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