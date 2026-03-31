// scripts/multisig/shared-utils.ts
import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Transaction, TransactionInstruction } from "@solana/web3.js";
import { loadOrCreateKeypair } from "../../utils/helpers";
import { calculatePDAs, TokenPDAs } from "../../../utils/helpers";
import { createEd25519Instruction, sign } from "./helpers";
import cngnidl from "../../../target/idl/cngn.json";

require("dotenv").config();

export interface MultisigContext {
  connection: web3.Connection;
  provider: anchor.AnchorProvider;
  program: Program;
  payer: Keypair;
  cngnMint: PublicKey;
  pdas: TokenPDAs;
  signers: Keypair[];
  multisigAccount: any;
}

/**
 * Initialize the multisig context with all necessary accounts and signers
 */
export async function initializeMultisigContext(): Promise<MultisigContext> {
  const connection = new web3.Connection(
    process.env.RPC_URL || "https://api.devnet.solana.com",
    "confirmed"
  );

  const provider = new anchor.AnchorProvider(connection, anchor.Wallet.local());
  anchor.setProvider(provider);

  const payer = (provider.wallet as anchor.Wallet).payer;
  const program = new anchor.Program(cngnidl, provider);

  console.log("\n=== Initializing Multisig Context ===");
  console.log("Program ID:", program.programId.toBase58());

  // Load mint
  const cngnMintKeypair = await loadOrCreateKeypair("cngnMint");
  console.log("Mint:", cngnMintKeypair.publicKey.toString());

  // Calculate PDAs
  const pdas: TokenPDAs = calculatePDAs(
    cngnMintKeypair.publicKey,
    program.programId
  );

  // // Load multisig signers
  // console.log("\n=== Loading Multisig Signers ===");
  // const signerNames = [
  //   "MULTISIG_OWNER_1",
  //   "MULTISIG_OWNER_2",
  //   // Add more if you have > 2 owners
  // ];

   const signers: Keypair[] = [];
  // for (const name of signerNames) {
  //   const signer = await loadOrCreateKeypair(name);
  //   signers.push(signer);
  //   console.log(`Loaded ${name}:`, signer.publicKey.toString());
  // }

  // // Fetch multisig account
   //@ts-ignore
   const multisigAccount = await program.account.multisig.fetch(pdas.multisig);
  // console.log("\n=== Multisig Info ===");
  // console.log("Nonce:", multisigAccount.nonce.toString());
  // console.log("Threshold:", multisigAccount.threshold);
  // console.log("Owners:", multisigAccount.owners.map((o) => o.toString()));

  // // Verify signers are owners
  // console.log("\n=== Verifying Signers ===");
  // const ownerSet = new Set(multisigAccount.owners.map((o) => o.toString()));
  // for (const signer of signers) {
  //   const isOwner = ownerSet.has(signer.publicKey.toString());
  //   console.log(
  //     `  ${signer.publicKey.toString()}: ${isOwner ? "✓ IS OWNER" : "✗ NOT OWNER"}`
  //   );
  //   if (!isOwner) {
  //     throw new Error(`Signer ${signer.publicKey} is not a multisig owner!`);
  //   }
  // }

  // if (signers.length < multisigAccount.threshold) {
  //   throw new Error(
  //     `Need at least ${multisigAccount.threshold} signers, but only have ${signers.length}`
  //   );
  // }

  return {
    connection,
    provider,
    program,
    payer,
    cngnMint: cngnMintKeypair.publicKey,
    pdas,
    signers,
    multisigAccount,
  };
}

/**
 * Build and send a multisig transaction
 */
export async function buildAndSendMultisigTransaction(
  context: MultisigContext,
  message: Buffer,
  instruction: TransactionInstruction
): Promise<string> {
  console.log("\n=== Building Transaction ===");
  console.log("Message hash:", message.toString("hex"));

  // Create Ed25519 signature instructions
  const ed25519Instructions: TransactionInstruction[] = [];
  for (const signer of context.signers) {
    const { signature, address } = sign(signer, message);
    console.log(`Signature from ${signer.publicKey}:`, signature.slice(0, 16).toString() + '...');
    ed25519Instructions.push(createEd25519Instruction(address, message, signature));
  }

  // Build transaction
  const tx = new Transaction();
  ed25519Instructions.forEach((ix) => tx.add(ix));
  tx.add(instruction);

  const { blockhash } = await context.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = context.payer.publicKey;

  console.log("\n=== Sending Transaction ===");
  console.log("Instructions:", tx.instructions.length);
  console.log("  -", ed25519Instructions.length, "Ed25519 signature instructions");
  console.log("  - 1 main instruction");

  // Send and confirm
  const signature = await context.provider.sendAndConfirm(tx, [], {
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

/**
 * Handle errors consistently across all operations
 */
export function handleError(error: any): void {
  console.error("\n=== Error ===");
  if (error.logs) {
    console.error("Transaction logs:");
    error.logs.forEach((log: string) => console.error(log));
  }
  console.error(error.message || error);
}