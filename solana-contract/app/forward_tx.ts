// Function to execute a forwarded transaction
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { calculatePDAs, createTokenAccountIfNeeded } from "../utils/helpers";

async function forwardTransaction(
    sendingUser: Keypair,
    recipientAddress: PublicKey,
    amount: anchor.BN
  ) {
    // Set up the connection to devnet
    const connection = new Connection(clusterApiUrl('devnet'));
    
    // Load the wallet and other actors from keypair files
    const walletKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync('wallet.json', 'utf-8')))
    );
    const mintKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync('mint-keypair.json', 'utf-8')))
    );
    const forwarderKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync('forwarder-keypair.json', 'utf-8')))
    );
    
    // Set up the provider for devnet
    const wallet = new anchor.Wallet(walletKeypair);
    const provider = new anchor.AnchorProvider(
      connection, 
      wallet, 
      { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);
  
    // Load the program
    const programId = new PublicKey("YOUR_PROGRAM_ID"); // Replace with your deployed program ID
    const idl = JSON.parse(fs.readFileSync('./target/idl/cngn.json', 'utf-8'));
    const program = new anchor.Program(idl, programId) as Program<Cngn>;
  
    // Calculate all PDAs for the token
    const pdas = calculatePDAs(mintKeypair.publicKey, program.programId);
  
    try {
      // Create token accounts if needed
      const senderTokenAccount = await createTokenAccountIfNeeded(
        connection,
        walletKeypair,
        sendingUser.publicKey,
        mintKeypair.publicKey
      );
      
      const recipientTokenAccount = await createTokenAccountIfNeeded(
        connection,
        walletKeypair,
        recipientAddress,
        mintKeypair.publicKey
      );
  
      // Calculate the transfer_auth PDA for the user's token account
      const [transferAuth] = PublicKey.findProgramAddressSync(
        [Buffer.from("transfer-auth"), senderTokenAccount.toBuffer()],
        program.programId
      );
  
      // Set the owner of the sender's token account to the transfer_auth PDA
      const setAuthorityTx = new Transaction().add(
        createSetAuthorityInstruction(
          senderTokenAccount,
          sendingUser.publicKey,
          2, // AuthorityType.AccountOwner
          transferAuth,
          [],
          TOKEN_PROGRAM_ID
        )
      );
  
      // Sign and send the transaction to set authority
      await provider.sendAndConfirm(setAuthorityTx, [sendingUser]);
      console.log("Set token account authority to transfer_auth PDA");
  
      // Create the signature for the forwarded transaction
      const message: Uint8Array = stringToUint8Array("CNGN Transfer");
      const signature = nacl.sign.detached(message, sendingUser.secretKey);
  
      // Verify the signature locally first
      const isValid = nacl.sign.detached.verify(
        message,
        signature,
        sendingUser.publicKey.toBuffer()
      );
      console.log("Signature verification:", isValid);
  
      if (!isValid) {
        throw new Error("Signature verification failed");
      }
  
      // Create the Ed25519 verification instruction
      const ed25519Instruction = Ed25519Program.createInstructionWithPublicKey({
        publicKey: sendingUser.publicKey.toBuffer(),
        message: message,
        signature: signature,
      });
  
      // Execute the forwarded transaction
      console.log("Executing forwarded transaction...");
      const txSignature = await program.methods
        .execute(
          bytesToHexString(message),
          bytesToHexString(signature),
          amount
        )
        .accounts({
          authority: provider.wallet.publicKey,
          forwarder: forwarderKeypair.publicKey,
          transferAuth: transferAuth,
          from: senderTokenAccount,
          to: recipientTokenAccount,
          blacklist: pdas.blacklist,
          sender: sendingUser.publicKey,
          tokenConfig: pdas.tokenConfig,
          canForward: pdas.canForward,
          mint: mintKeypair.publicKey,
          canMint: pdas.canMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .preInstructions([ed25519Instruction])
        .signers([forwarderKeypair])
        .rpc();
  
      console.log("Forwarded transaction executed with signature:", txSignature);
      
      // Get and display token balances
      const senderBalance = await getAccount(connection, senderTokenAccount);
      const recipientBalance = await getAccount(connection, recipientTokenAccount);
      
      console.log("Sender balance after transaction:", senderBalance.amount.toString());
      console.log("Recipient balance after transaction:", recipientBalance.amount.toString());
      
      return txSignature;
    } catch (error) {
      console.error("Error during forwarded transaction:", error);
      throw error;
    }
  }
  