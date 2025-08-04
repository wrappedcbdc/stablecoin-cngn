import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Cngn } from "../target/types/cngn";
import { assert } from "chai";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    getAccount
} from "@solana/spl-token";
import { calculatePDAs } from "../utils/helpers";
import { initializeToken, setupUserAccounts } from "../utils/token_initializer";
import { transferAuthorityToPDA } from "./transfer_authority_to_pda";

describe("cngn burn test", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
 const payer = (provider.wallet as anchor.Wallet).payer;
    const program = anchor.workspace.Cngn as Program<Cngn>;

    const mint = Keypair.generate();

   

    const user1 = Keypair.generate();
    const user2 = Keypair.generate();

  
 // PDAs and token config 
 let pdas;
    let adminTokenAccount: PublicKey;
    let user1TokenAccount: PublicKey;
    let user2TokenAccount: PublicKey;

    before(async () => {
     // Calculate all PDAs for the token
        pdas = calculatePDAs(mint.publicKey, program.programId);

         // Fund test accounts for gas
            const fundAccounts = [
               provider.wallet.publicKey,
              user1.publicKey,
              user2.publicKey,
             
            ];
        
            for (const account of fundAccounts) {
              await provider.connection.requestAirdrop(account, 1 * anchor.web3.LAMPORTS_PER_SOL);
            }
        console.log("Initializing token...");

      // Initialize the token
         await initializeToken(program, provider, mint, pdas);
        let afterMintInfo=await transferAuthorityToPDA(pdas, mint, payer, provider)
         // Assertions to verify transfer
         assert(afterMintInfo.mintAuthority?.equals(pdas.mintAuthority), "Mint authority should be the PDA");
         assert(afterMintInfo.freezeAuthority?.equals(payer.publicKey), "Freeze authority should be the PDA");
         // Create token accounts for all users
         const userAccounts = await setupUserAccounts(
           provider,
           [provider.wallet.payer,user1, user2],
           mint.publicKey
         );
    
         [
            adminTokenAccount,
           user1TokenAccount, 
           user2TokenAccount, 
         
         ] = userAccounts;

        
            console.log("Token accounts created:");
    });

    it("Burns tokens from admin account", async () => {
        const initialBalance = (await getAccount(provider.connection, adminTokenAccount)).amount;
        const burnAmount = new anchor.BN(initialBalance.toString()).div(new anchor.BN(4));

        console.log(`Admin burning ${burnAmount.toString()} tokens...`);

        await program.methods
            .burn(burnAmount)
            .accounts({
                owner: provider.wallet.publicKey,
                tokenConfig:pdas.tokenConfig,
                mint: mint.publicKey,
                burnFrom: adminTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        const updatedBalance = (await getAccount(provider.connection, adminTokenAccount)).amount;
        assert.equal(updatedBalance.toString(), new anchor.BN(initialBalance.toString()).sub(burnAmount).toString());
    });

    it("Burns tokens from user1 successfully", async () => {
        const initialBalance = (await getAccount(provider.connection, user1TokenAccount)).amount;
        const burnAmount = new anchor.BN(initialBalance.toString()).div(new anchor.BN(4));

        console.log(`User1 burning ${burnAmount.toString()} tokens...`);

        await program.methods
            .burn(burnAmount)
            .accounts({
                owner: user1.publicKey,
                tokenConfig:pdas.tokenConfig,
                mint: mint.publicKey,
                burnFrom: user1TokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([user1])
            .rpc();

        const updatedBalance = (await getAccount(provider.connection, user1TokenAccount)).amount;
        assert.equal(updatedBalance.toString(), new anchor.BN(initialBalance.toString()).sub(burnAmount).toString());
    });

    it("Burns all remaining tokens from user1", async () => {
        const initialBalance = (await getAccount(provider.connection, user1TokenAccount)).amount;
        const remainingBalance = new anchor.BN(initialBalance.toString());

        console.log(`Burning remaining ${remainingBalance.toString()} tokens from user1...`);

        await program.methods
            .burn(remainingBalance)
            .accounts({
                owner: user1.publicKey,
                tokenConfig:pdas.tokenConfig,
                mint: mint.publicKey,
                burnFrom: user1TokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([user1])
            .rpc();

        const finalBalance = (await getAccount(provider.connection, user1TokenAccount)).amount;
        assert.equal(finalBalance.toString(), "0");
    });

    it("Burns tokens from user2 successfully", async () => {
        const initialBalance = (await getAccount(provider.connection, user2TokenAccount)).amount;
        const burnAmount = new anchor.BN(initialBalance.toString()).div(new anchor.BN(4));

        console.log(`User2 burning ${burnAmount.toString()} tokens...`);

        await program.methods
            .burn(burnAmount)
            .accounts({
                owner: user2.publicKey,
                tokenConfig:pdas.tokenConfig,
                mint: mint.publicKey,
                burnFrom: user2TokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([user2])
            .rpc();

        const updatedBalance = (await getAccount(provider.connection, user2TokenAccount)).amount;
        assert.equal(updatedBalance.toString(), new anchor.BN(initialBalance.toString()).sub(burnAmount).toString());
    });

    it("Prevents user1 from burning tokens from user2's account", async () => {
        console.log("Testing unauthorized burn attempt...");
        try {
            await program.methods
                .burn(new anchor.BN(1000000))
                .accounts({
                    owner: user1.publicKey,
                    tokenConfig:pdas.tokenConfig,
                    mint: mint.publicKey,
                    burnFrom: user2TokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([user1])
                .rpc();

            assert.fail("User1 should not be able to burn User2's tokens");
        } catch (error) {
            console.log("Caught expected error:", error.toString());
            assert.include(error.toString(), "InvalidOwner");
        }
    });

    it("Fails to burn more tokens than available", async () => {
        console.log("Testing burning more tokens than available...");
        try {
            await program.methods
                .burn(new anchor.BN(10000000000))
                .accounts({
                    owner: user1.publicKey,
                    tokenConfig:pdas.tokenConfig,
                    mint: mint.publicKey,
                    burnFrom: user1TokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([user1])
                .rpc();

            assert.fail("Burning should have failed due to insufficient balance");
        } catch (error) {
            console.log("Caught expected error:", error.toString());
            assert.include(error.toString(), "insufficient");
        }
    });
});
