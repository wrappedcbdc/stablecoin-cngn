import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { calculatePDAs, TokenPDAs } from '../../utils/helpers';
import { loadOrCreateKeypair } from '../utils/helpers';
import cngnidl from '../../target/idl/cngn.json';
import { setupUserAccounts, TOKEN_PARAMS } from '../../utils/token_initializer';
import { 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    createAssociatedTokenAccountInstruction,
    createBurnCheckedInstruction,
    getAccount, 
    getAssociatedTokenAddressSync, 
    TOKEN_2022_PROGRAM_ID,
    getMint
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
        const cngnMintKeypair = await loadOrCreateKeypair("cngnMint");
        console.log("Mint Keypair:", cngnMintKeypair.publicKey.toString());

        let me: Keypair = Keypair.fromSecretKey(
            bs58.decode(process.env.PRIVATE_KEY!)
        );

        let burnMe = new PublicKey("6uibpu3qJLsxqP4He9nnaXcoSmkaWxgrkfK1j5qmtVVp")

        // Create ATA for the user who will burn tokens
        let userTokenAccount = await createATAForUser(
            connection, 
            payer, 
            cngnMintKeypair.publicKey, 
            burnMe
        );

        // Get mint info to verify total supply
        console.log("\n=== Before Burn ===");
        const mintInfoBefore = await getMint(
            connection,
            cngnMintKeypair.publicKey,
            "confirmed",
            TOKEN_2022_PROGRAM_ID
        );
        
        const userBalanceBefore = await getAccount(
            connection, 
            userTokenAccount, 
            "confirmed", 
            TOKEN_2022_PROGRAM_ID
        );
        
        console.log("Total Supply:", mintInfoBefore.supply.toString());
        console.log("User balance:", userBalanceBefore.amount.toString());
        console.log("===================\n");

        // Create burn instruction
        const burnAmount = BigInt(1000_000_000); // Burn 100 tokens (adjust as needed)
        console.log(`Attempting to burn ${burnAmount.toString()} tokens...`);

        const burnIx = createBurnCheckedInstruction(
            userTokenAccount,           // Token account to burn from
            cngnMintKeypair.publicKey, // Mint
            payer.publicKey,           // Owner of the token account
            burnAmount,                // Amount to burn
            6,                         // Decimals
            undefined,                 // Additional signers
            TOKEN_2022_PROGRAM_ID      // Token Extension Program ID
        );

        const tx = new web3.Transaction().add(burnIx);

        // METHOD 1: Try-Catch (Immediate Success/Failure)
        let signature: string;
        let burnSuccess = false;
        
        try {
            signature = await provider.sendAndConfirm(tx, [payer]);
            console.log("\n✅ BURN SUCCESSFUL!");
            console.log("Transaction Signature:", signature);
            burnSuccess = true;
        } catch (error: any) {
            console.error("\n❌ BURN FAILED!");
            console.error("Error:", error.message);
            
            if (error.logs) {
                console.error("\nTransaction Logs:");
                error.logs.forEach((log: string) => console.error(log));
            }
            
            throw error; // Re-throw to stop execution
        }

        // METHOD 2: Verify with Transaction Receipt
        if (burnSuccess && signature) {
            console.log("\nVerifying transaction...");
            
            const txDetails = await connection.getTransaction(signature, {
                maxSupportedTransactionVersion: 0,
                commitment: "confirmed"
            });

            if (txDetails?.meta?.err) {
                console.error("❌ Transaction failed on-chain!");
                console.error("Error:", txDetails.meta.err);
                burnSuccess = false;
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

        // METHOD 3: Verify with Balance and Supply Changes
        if (burnSuccess) {
            console.log("\n=== After Burn ===");
            
            const mintInfoAfter = await getMint(
                connection,
                cngnMintKeypair.publicKey,
                "confirmed",
                TOKEN_2022_PROGRAM_ID
            );
            
            const userBalanceAfter = await getAccount(
                connection, 
                userTokenAccount, 
                "confirmed", 
                TOKEN_2022_PROGRAM_ID
            );

            console.log("Total Supply:", mintInfoAfter.supply.toString());
            console.log("User balance:", userBalanceAfter.amount.toString());

            // Calculate changes
            const supplyDecrease = Number(mintInfoBefore.supply - mintInfoAfter.supply);
            const balanceDecrease = Number(userBalanceBefore.amount - userBalanceAfter.amount);

            console.log("\n=== Changes ===");
            console.log("Supply decreased by:", supplyDecrease);
            console.log("User balance decreased by:", balanceDecrease);

            // Verify the burn amount matches
            if (supplyDecrease === Number(burnAmount) && balanceDecrease === Number(burnAmount)) {
                console.log("✅ BURN VERIFICATION PASSED!");
                console.log(`Successfully burned ${burnAmount.toString()} tokens`);
            } else {
                console.warn("⚠️  Changes don't match expected amount!");
                console.warn(`Expected: ${burnAmount.toString()}`);
                console.warn(`Supply decreased by: ${supplyDecrease}`);
                console.warn(`Balance decreased by: ${balanceDecrease}`);
            }
            console.log("===============\n");
        }

        // METHOD 4: Return a result object
        return {
            success: burnSuccess,
            signature: signature!,
            amount: burnAmount.toString(),
            tokenAccount: userTokenAccount.toBase58(),
            beforeBalances: {
                totalSupply: mintInfoBefore.supply.toString(),
                userBalance: userBalanceBefore.amount.toString()
            },
            afterBalances: burnSuccess ? {
                totalSupply: (await getMint(connection, cngnMintKeypair.publicKey, "confirmed", TOKEN_2022_PROGRAM_ID)).supply.toString(),
                userBalance: (await getAccount(connection, userTokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID)).amount.toString()
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
async function executeBurnWithDetection(
    connection: any,
    provider: anchor.AnchorProvider,
    tokenAccount: PublicKey,
    mint: PublicKey,
    amount: bigint,
    decimals: number,
    owner: Keypair
): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
    supplyBefore?: string;
    supplyAfter?: string;
    balanceBefore?: string;
    balanceAfter?: string;
}> {
    
    try {
        // 1. Get balances and supply before
        const mintBefore = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
        const accountBefore = await getAccount(connection, tokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID);

        console.log("\n📊 Before Burn:");
        console.log(`  Total Supply: ${mintBefore.supply.toString()}`);
        console.log(`  Account Balance: ${accountBefore.amount.toString()}`);

        // 2. Create and send burn transaction
        const burnIx = createBurnCheckedInstruction(
            tokenAccount,
            mint,
            owner.publicKey,
            amount,
            decimals,
            undefined,
            TOKEN_2022_PROGRAM_ID
        );

        const tx = new web3.Transaction().add(burnIx);
        
        console.log("\n🔥 Sending burn transaction...");
        const signature = await provider.sendAndConfirm(tx, [owner]);

        // 3. Get balances and supply after
        const mintAfter = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
        const accountAfter = await getAccount(connection, tokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID);

        console.log("\n📊 After Burn:");
        console.log(`  Total Supply: ${mintAfter.supply.toString()}`);
        console.log(`  Account Balance: ${accountAfter.amount.toString()}`);

        // 4. Verify the burn
        const supplyDecrease = mintBefore.supply - mintAfter.supply;
        const balanceDecrease = accountBefore.amount - accountAfter.amount;

        console.log("\n📉 Changes:");
        console.log(`  Supply decreased: ${supplyDecrease.toString()}`);
        console.log(`  Balance decreased: ${balanceDecrease.toString()}`);

        if (supplyDecrease === amount && balanceDecrease === amount) {
            console.log("\n✅ Burn succeeded and verified!");
        } else {
            console.warn("\n⚠️  Burn amounts don't match expected values!");
        }

        console.log(`📝 Signature: ${signature}`);

        return {
            success: true,
            signature,
            supplyBefore: mintBefore.supply.toString(),
            supplyAfter: mintAfter.supply.toString(),
            balanceBefore: accountBefore.amount.toString(),
            balanceAfter: accountAfter.amount.toString()
        };

    } catch (error: any) {
        console.error("\n❌ Burn failed!");
        console.error("Error:", error.message);

        if (error.logs) {
            console.error("\nTransaction Logs:");
            error.logs.forEach((log: string) => console.error(log));
        }

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

export { executeBurnWithDetection };