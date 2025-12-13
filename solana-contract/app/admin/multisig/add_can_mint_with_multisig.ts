import * as anchor from '@coral-xyz/anchor';
import { PublicKey, TransactionMessage, TransactionInstruction } from '@solana/web3.js';
import * as multisig from "@sqds/multisig";
import { calculatePDAs, TokenPDAs } from '../../../utils/helpers';
import cngnidl from '../../../target/idl/cngn.json';
import { createSquadsMultisig } from '../../multisig';
import { loadOrCreateKeypair } from '../../utils/helpers';
require('dotenv').config();

const { web3 } = anchor;

export async function main() {
    const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");

    const provider = new anchor.AnchorProvider(
        connection,
        anchor.Wallet.local(),
    );
    anchor.setProvider(provider);

    const payer = (provider.wallet as anchor.Wallet).payer;
    const program = new anchor.Program(cngnidl, provider);

    console.log("Program ID:", program.programId.toBase58());
    
    try {
        const cngnMintKeypair = await loadOrCreateKeypair("cngnMint");
        console.log("Mint Keypair:", cngnMintKeypair.publicKey.toString());

        const pdas: TokenPDAs = calculatePDAs(cngnMintKeypair.publicKey, program.programId);

        // Create or get Squads multisig
        const { multisigPDA, vaultPDA, members } = await createSquadsMultisig(
            connection,
            payer
        );
        
        console.log("Squads Multisig PDA:", multisigPDA.toString());
        console.log("Vault PDA:", vaultPDA.toString());
        console.log("Members:", members.map(m => m.toString()));
        
        // Set up event listener
        let eventReceived = false;
        const listenerId = program.addEventListener('whitelistedMinter', (event: any, slot: number) => {
            console.log("\n=== Event Received ===");
            console.log("Event triggered at slot:", slot);
            console.log("Added Minter address:", event.authority.toString());
            console.log("Token Mint address:", event.mint.toString());
            console.log("====================\n");
            eventReceived = true;
        });

        console.log("Event listener registered, creating transaction proposal...");
        
        // Create the instruction for your program
        const addCanMintIx = await program.methods
            .addCanMint(payer.publicKey)
            .accounts({
                authority: vaultPDA, // Use the vault as the authority
                tokenConfig: pdas.tokenConfig,
                blacklist: pdas.blacklist,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts,
            })
            .instruction();

        // Get current transaction index
        const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
            connection,
            multisigPDA
        );
        
        const transactionIndex = multisigAccount.transactionIndex+1;
        
        // Create vault transaction proposal
        const [proposalPDA] = multisig.getProposalPda({
            multisigPda: multisigPDA,
            transactionIndex,
        });
        
        const [transactionPDA] = multisig.getTransactionPda({
            multisigPda: multisigPDA,
            index: transactionIndex,
        });
        
        console.log("Creating transaction proposal...");
        
        // Create the proposal
        const createProposalIx = multisig.instructions.vaultTransactionCreate({
            multisigPda: multisigPDA,
            transactionIndex,
            creator: payer.publicKey,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: new TransactionMessage({
                payerKey: vaultPDA,
                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                instructions: [addCanMintIx],
            }),
            memo: "Add can mint via Squads multisig",
        });
        
        const createProposalTx = new web3.Transaction().add(createProposalIx);
        createProposalTx.feePayer = payer.publicKey;
        createProposalTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const createProposalSig = await connection.sendTransaction(createProposalTx, [payer]);
        await connection.confirmTransaction(createProposalSig);
        console.log("Proposal created:", createProposalSig);
        
        // Approve with signer 1
        const signer1 = loadOrCreateKeypair("signer1");
        const approveIx1 = multisig.instructions.proposalApprove({
            multisigPda: multisigPDA,
            transactionIndex,
            member: signer1.publicKey,
        });
        
        const approveTx1 = new web3.Transaction().add(approveIx1);
        approveTx1.feePayer = payer.publicKey;
        approveTx1.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const approveSig1 = await connection.sendTransaction(approveTx1, [payer, signer1]);
        await connection.confirmTransaction(approveSig1);
        console.log("Signer 1 approved:", approveSig1);
        
        // Approve with signer 2
        const signer2 = loadOrCreateKeypair("signer2");
        const approveIx2 = multisig.instructions.proposalApprove({
            multisigPda: multisigPDA,
            transactionIndex,
            member: signer2.publicKey,
        });
        
        const approveTx2 = new web3.Transaction().add(approveIx2);
        approveTx2.feePayer = payer.publicKey;
        approveTx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const approveSig2 = await connection.sendTransaction(approveTx2, [payer, signer2]);
        await connection.confirmTransaction(approveSig2);
        console.log("Signer 2 approved:", approveSig2);
        
        // Execute the transaction
        console.log("Executing transaction...");
        const executeIx = await  multisig.instructions.vaultTransactionExecute({
            connection,
            multisigPda: multisigPDA,
            transactionIndex,
            member: payer.publicKey,
            programId: program.programId,
        });
        
        const executeTx = new web3.Transaction().add(executeIx);
        executeTx.feePayer = payer.publicKey;
        executeTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const executeSig = await connection.sendTransaction(executeTx, [payer]);
        await connection.confirmTransaction(executeSig);
        console.log("Transaction executed:", executeSig);
        
        // Wait for event
        console.log("Waiting for event...");
        const maxWaitTime = 30000;
        const startTime = Date.now();
        
        while (!eventReceived && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (eventReceived) {
            console.log("Event successfully received!");
        } else {
            console.warn("Warning: Event not received within timeout period");
        }

        await program.removeEventListener(listenerId);
        console.log("Event listener removed");
        
        return executeSig;

    } catch (error: any) {
        console.error("\n=== Error Details ===");
        
        if (error.error) {
            console.error("Anchor Error Code:", error.error.errorCode?.code);
            console.error("Anchor Error Number:", error.error.errorCode?.number);
            console.error("Error Message:", error.error.errorMessage);
        }
        
        if (error.logs) {
            console.error("\nTransaction Logs:");
            error.logs.forEach((log: string) => console.error(log));
        }
        
        console.error("\nFull Error:", error.message || error);
        console.error("====================\n");
        
        throw error;
    }
}

main().then(
    () => {
        console.log("Script completed successfully");
        process.exit(0);
    },
    (err) => {
        console.error("\nScript failed:", err);
        process.exit(1);
    }
);