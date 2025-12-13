import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { calculatePDAs, TokenPDAs } from '../../utils/helpers';
import { loadOrCreateKeypair } from '../utils/helpers';
import cngnidl from '../../target/idl/cngn.json';
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

        const upgradeAuthority = new PublicKey(process.env.UPGRADE_AUTHORITY);
        console.log("Upgrade Authority:", upgradeAuthority.toString());

        // Calculate all PDAs for the token
        const pdas: TokenPDAs = calculatePDAs(cngnMintKeypair.publicKey, program.programId);

        // Set up event listener BEFORE sending transaction
        let eventReceived = false;
        const listenerId = program.addEventListener('blackListedMinter', (event: any, slot: number) => {
            console.log("\n=== Event Received ===");
            console.log("Event triggered at slot:", slot);
            console.log("Event data:", event);
            console.log("Added Minter address:", event.authority.toString());
            console.log("Token Mint address:", event.mint.toString());
            console.log("====================\n");
            eventReceived = true;
        });

        console.log("Event listener registered, sending transaction...");

        // Send the transaction
        const tx = await program.methods
            .removeMintAmount(payer.publicKey)
            .accounts({
                authority: provider.wallet.publicKey,
                tokenConfig: pdas.tokenConfig,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts
            })
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