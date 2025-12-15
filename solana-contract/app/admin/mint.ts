import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { calculatePDAs, TokenPDAs } from '../../utils/helpers';
import { loadOrCreateKeypair } from '../utils/helpers';
import cngnidl from '../../target/idl/cngn.json';
import { setupUserAccounts, TOKEN_PARAMS } from '../../utils/token_initializer';
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccount, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { transferMintAuthority } from '../../utils/transfer_mint_authority';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

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

    console.log("Program ID:", program.programId.toBase58());

    try {

        // Create the mint keypair
        const cngnMintKeypair = await loadOrCreateKeypair("cngnMint");
        console.log("Mint Keypair:", cngnMintKeypair.publicKey.toString());

        // Calculate all PDAs for the token
        const pdas: TokenPDAs = calculatePDAs(cngnMintKeypair.publicKey, program.programId);
        let authorizedUserTokenAccount: PublicKey;
        // Set up event listener BEFORE sending transaction
        let eventReceived = false;
        const listenerId = program.addEventListener('tokensMintedEvent', (event: any, slot: number) => {
            console.log("\n=== Event Received ===");
            console.log("Event triggered at slot:", slot);
            console.log("Event data:", event);
            console.log("Amount:", event.amount.toString());
            console.log("Recipient address:", event.to.toString());
            console.log("Token Mint address:", event.mint.toString());
            console.log("====================\n");
            eventReceived = true;
        });
        const listenerId2 = program.addEventListener('blackListedMinter', (event: any, slot: number) => {
            console.log("\n=== Event Received ===");
            console.log("Event triggered at slot:", slot);
            console.log("Event data:", event);
            console.log("Added Minter address:", event.authority.toString());
            console.log("Token Mint address:", event.mint.toString());
            console.log("====================\n");
            eventReceived = true;
        });
        console.log("Event listener registered, sending transaction...");
        let me: PublicKey = new PublicKey(
           "83p8Pmc2jU4by5ZSyhwYEQw7D5YAFz9joC9mnw49NzoP"
        );
         //await transferMintAuthority(pdas.mintAuthority, cngnMintKeypair.publicKey, payer, connection);
       let userAccount= await createATAForUser(connection,payer,  cngnMintKeypair.publicKey, payer.publicKey);
const anyone = loadOrCreateKeypair("ANYONE");
        // Send the transaction
        const tx = await program.methods
            .mint(TOKEN_PARAMS.mintAmount)
            .accounts({
                authority: anyone.publicKey,
                tokenConfig: pdas.tokenConfig,
                mintAuthority: pdas.mintAuthority,
                mint: cngnMintKeypair.publicKey,
                tokenAccount: userAccount,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                blacklist: pdas.blacklist,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts
            })
            //.signers([payer])
            .rpc();

        console.log("Transaction signature:", tx);

        // Wait for event to be received (with timeout)
        console.log("Waiting for event...");
        const maxWaitTime = 30000; // 30 seconds
        const startTime = Date.now();

        while (!eventReceived && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (eventReceived) {
            console.log("Event successfully received!");
        } else {
            console.warn("Warning: Event not received within timeout period");
        }

        // Remove event listener
        await program.removeEventListener(listenerId);
        await program.removeEventListener(listenerId2);
        console.log("Event listener removed");

    } catch (error: any) {
        console.error("\n=== Error Details ===");

        // Check for specific Anchor errors
        if (error.error) {
            console.error("Anchor Error Code:", error.error.errorCode?.code);
            console.error("Anchor Error Number:", error.error.errorCode?.number);
            console.error("Error Message:", error.error.errorMessage);
        }

        // Check for transaction errors
        if (error.logs) {
            console.error("\nTransaction Logs:");
            error.logs.forEach((log: string) => console.error(log));
        }

        // Check for simulation errors
        if (error.simulationResponse) {
            console.error("\nSimulation Error:");
            console.error(error.simulationResponse);
        }

        // Generic error info
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


async function createATAForUser(
    connection: any,
    payer: Keypair,
    mint: PublicKey,        // Just the address, no keypair needed
    owner: PublicKey        // The wallet that will own the tokens
): Promise<PublicKey> {
    
    console.log("\n=== Creating ATA ===");
    console.log("Mint:", mint.toBase58());
    console.log("Owner:", owner.toBase58());
    
    // Calculate the ATA address deterministically
    // No keypair needed!
    const ata = getAssociatedTokenAddressSync(
        mint,
        owner,
        false, // allowOwnerOffCurve
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    console.log("ATA Address:", ata.toBase58());
    
    // Check if ATA already exists
    const accountInfo = await connection.getAccountInfo(ata);
    
    if (accountInfo) {
        console.log("✓ ATA already exists");
        return ata;
    }
    
    console.log("Creating new ATA...");
    
    // Create the ATA instruction
    const createAtaIx = createAssociatedTokenAccountInstruction(
        payer.publicKey,  // payer
        ata,              // ata address
        owner,            // owner (the wallet that will own tokens)
        mint,             // mint address
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Send transaction
    const tx = new web3.Transaction().add(createAtaIx);
    const signature = await web3.sendAndConfirmTransaction(
        connection,
        tx,
        [payer]
    );
    
    console.log("✓ ATA created! Signature:", signature);
    console.log("===================\n");
    
    return ata;
}