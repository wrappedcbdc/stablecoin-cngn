import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { calculatePDAs, TokenPDAs } from '../utils/helpers';
import { loadOrCreateKeypair } from './utils/helpers';
import cngnidl from '../target/idl/cngn.json';
import { setupUserAccounts, TOKEN_PARAMS } from '../utils/token_initializer';
import { 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    createAssociatedTokenAccountInstruction, 
    createTransferCheckedInstruction, 
    createTransferCheckedWithTransferHookInstruction, 
    getAccount, 
    getAssociatedTokenAddressSync, 
    TOKEN_2022_PROGRAM_ID 
} from '@solana/spl-token';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

require('dotenv').config();

const { web3 } = anchor;

async function main() {
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
        const cngnMintKeypair = await loadOrCreateKeypair("cngnMint4");
        console.log("Mint Keypair:", cngnMintKeypair.publicKey.toString());

        let me: Keypair = Keypair.fromSecretKey(
            bs58.decode(process.env.PRIVATE_KEY!)
        );

        // Create ATAs
        let user1TokenAccount = await createATAForUser(
            connection, 
            payer, 
            cngnMintKeypair.publicKey, 
            payer.publicKey
        );
        
        let user2TokenAccount = await createATAForUser(
            connection, 
            payer, 
            cngnMintKeypair.publicKey, 
            me.publicKey
        );

        // Get balances BEFORE transfer
        console.log("\n=== Before Transfer ===");
        const beforeSenderBalance = await getAccount(
            connection, 
            user1TokenAccount, 
            "confirmed", 
            TOKEN_2022_PROGRAM_ID
        );
        const beforeRecipientBalance = await getAccount(
            connection, 
            user2TokenAccount, 
            "confirmed", 
            TOKEN_2022_PROGRAM_ID
        );
        
        console.log("Sender balance:", beforeSenderBalance.amount.toString());
        console.log("Recipient balance:", beforeRecipientBalance.amount.toString());
        console.log("=======================\n");

        // Create transfer instruction
        const transferAmount = BigInt(TOKEN_PARAMS.transferAmount.toString());
        console.log(`Attempting to transfer ${transferAmount.toString()} tokens...`);

        let transferTx = await createTransferCheckedInstruction(
             user1TokenAccount, // Transfer from
             cngnMintKeypair.publicKey,
             user2TokenAccount, // Transfer to
             payer.publicKey, // Source Token Account owner
             250,  // Amount
             6,
             undefined, // Additional signers
             TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
           );
        const tx = new web3.Transaction().add(transferTx);

        // METHOD 1: Try-Catch (Immediate Success/Failure)
        let signature: string;
        let transferSuccess = false;
        
        try {
            signature = await provider.sendAndConfirm(tx, [payer]);
            console.log("\n✅ TRANSFER SUCCESSFUL!");
            console.log("Transaction Signature:", signature);
            transferSuccess = true;
        } catch (error: any) {
            console.error("\n❌ TRANSFER FAILED!");
            console.error("Error:", error.message);
            
            if (error.logs) {
                console.error("\nTransaction Logs:");
                error.logs.forEach((log: string) => console.error(log));
            }
            
            throw error; // Re-throw to stop execution
        }

        // METHOD 2: Verify with Transaction Receipt
        if (transferSuccess && signature) {
            console.log("\nVerifying transaction...");
            
            const txDetails = await connection.getTransaction(signature, {
                maxSupportedTransactionVersion: 0,
                commitment: "confirmed"
            });

            if (txDetails?.meta?.err) {
                console.error("❌ Transaction failed on-chain!");
                console.error("Error:", txDetails.meta.err);
                transferSuccess = false;
            } else {
                console.log("✅ Transaction confirmed on-chain");
                
                // Log any program logs
                if (txDetails?.meta?.logMessages) {
                    console.log("\n=== Transaction Logs ===");
                    txDetails.meta.logMessages.forEach(log => console.log(log));
                    console.log("========================\n");
                }
            }
        }

        // METHOD 3: Verify with Balance Changes
        if (transferSuccess) {
            console.log("\n=== After Transfer ===");
            
            const afterSenderBalance = await getAccount(
                connection, 
                user1TokenAccount, 
                "confirmed", 
                TOKEN_2022_PROGRAM_ID
            );
            const afterRecipientBalance = await getAccount(
                connection, 
                user2TokenAccount, 
                "confirmed", 
                TOKEN_2022_PROGRAM_ID
            );

            console.log("Sender balance:", afterSenderBalance.amount.toString());
            console.log("Recipient balance:", afterRecipientBalance.amount.toString());

            // Calculate changes
            const senderChange = Number(beforeSenderBalance.amount - afterSenderBalance.amount);
            const recipientChange = Number(afterRecipientBalance.amount - beforeRecipientBalance.amount);

            console.log("\n=== Balance Changes ===");
            console.log("Sender change:", -senderChange);
            console.log("Recipient change:", +recipientChange);

            // Verify the transfer amount matches
            if (senderChange === Number(transferAmount) && recipientChange === Number(transferAmount)) {
                console.log("✅ BALANCE VERIFICATION PASSED!");
                console.log(`Successfully transferred ${transferAmount.toString()} tokens`);
            } else {
                console.warn("⚠️  Balance changes don't match expected amount!");
                console.warn(`Expected: ${transferAmount.toString()}`);
                console.warn(`Sender decreased by: ${senderChange}`);
                console.warn(`Recipient increased by: ${recipientChange}`);
            }
            console.log("=======================\n");
        }

        // METHOD 4: Return a result object
        return {
            success: transferSuccess,
            signature: signature!,
            amount: transferAmount.toString(),
            from: user1TokenAccount.toBase58(),
            to: user2TokenAccount.toBase58(),
            beforeBalances: {
                sender: beforeSenderBalance.amount.toString(),
                recipient: beforeRecipientBalance.amount.toString()
            },
            afterBalances: transferSuccess ? {
                sender: (await getAccount(connection, user1TokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID)).amount.toString(),
                recipient: (await getAccount(connection, user2TokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID)).amount.toString()
            } : null
        };

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

        if (error.simulationResponse) {
            console.error("\nSimulation Error:");
            console.error(error.simulationResponse);
        }

        console.error("\nFull Error:", error.message || error);
        console.error("====================\n");

        // Return failure result
        return {
            success: false,
            error: error.message,
            logs: error.logs || []
        };
    }
}

// Alternative: Wrapper function with detailed success/failure handling
async function executeTransferWithDetection(
    connection: any,
    provider: anchor.AnchorProvider,
    from: PublicKey,
    to: PublicKey,
    mint: PublicKey,
    amount: bigint,
    decimals: number,
    owner: Keypair
): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
    balancesBefore?: { from: string; to: string };
    balancesAfter?: { from: string; to: string };
}> {
    
    try {
        // 1. Get balances before
        const beforeFrom = await getAccount(connection, from, "confirmed", TOKEN_2022_PROGRAM_ID);
        const beforeTo = await getAccount(connection, to, "confirmed", TOKEN_2022_PROGRAM_ID);

        console.log("\n📊 Before Transfer:");
        console.log(`  From: ${beforeFrom.amount.toString()}`);
        console.log(`  To: ${beforeTo.amount.toString()}`);

        // 2. Create and send transaction
        const transferIx = await createTransferCheckedWithTransferHookInstruction(
            connection,
            from,
            mint,
            to,
            owner.publicKey,
            amount,
            decimals,
            undefined,
            undefined,
            TOKEN_2022_PROGRAM_ID,
        );

        const tx = new web3.Transaction().add(transferIx);
        
        console.log("\n🚀 Sending transfer transaction...");
        const signature = await provider.sendAndConfirm(tx, [owner]);

        // 3. Get balances after
        const afterFrom = await getAccount(connection, from, "confirmed", TOKEN_2022_PROGRAM_ID);
        const afterTo = await getAccount(connection, to, "confirmed", TOKEN_2022_PROGRAM_ID);

        console.log("\n📊 After Transfer:");
        console.log(`  From: ${afterFrom.amount.toString()}`);
        console.log(`  To: ${afterTo.amount.toString()}`);

        console.log("\n✅ Transfer succeeded!");
        console.log(`📝 Signature: ${signature}`);

        return {
            success: true,
            signature,
            balancesBefore: {
                from: beforeFrom.amount.toString(),
                to: beforeTo.amount.toString()
            },
            balancesAfter: {
                from: afterFrom.amount.toString(),
                to: afterTo.amount.toString()
            }
        };

    } catch (error: any) {
        console.error("\n❌ Transfer failed!");
        console.error("Error:", error.message);

        return {
            success: false,
            error: error.message
        };
    }
}

main().then(
    (result) => {
        console.log("\n=== Final Result ===");
        console.log(JSON.stringify(result, null, 2));
        console.log("====================\n");
        console.log("Script completed");
        process.exit(result?.success ? 0 : 1);
    },
    (err) => {
        console.error("\nScript failed:", err);
        process.exit(1);
    }
);

async function createATAForUser(
    connection: any,
    payer: Keypair,
    mint: PublicKey,
    owner: PublicKey
): Promise<PublicKey> {
    console.log("\n=== Creating ATA ===");
    console.log("Mint:", mint.toBase58());
    console.log("Owner:", owner.toBase58());

    const ata = getAssociatedTokenAddressSync(
        mint,
        owner,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    console.log("ATA Address:", ata.toBase58());

    const accountInfo = await connection.getAccountInfo(ata);

    if (accountInfo) {
        console.log("✓ ATA already exists");
        return ata;
    }

    console.log("Creating new ATA...");

    const createAtaIx = createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        owner,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

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

export { executeTransferWithDetection };