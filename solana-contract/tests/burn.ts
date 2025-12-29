import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Cngn } from "../target/types/cngn";
import { assert } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
    TOKEN_2022_PROGRAM_ID,
    getAccount,
    burn,
    createBurnInstruction
} from "@solana/spl-token";
import { calculatePDAs } from "../utils/helpers";
import { initializeToken, setupUserAccounts, TOKEN_PARAMS } from "../utils/token_initializer";
import { transferAuthorityToPDA } from "./transfer-authority-to-pda";

describe("cngn burn test", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const payer = (provider.wallet as anchor.Wallet).payer;
    const program = anchor.workspace.Cngn as Program<Cngn>;

    const mint = Keypair.generate();
    const minter = Keypair.generate();
    const user1 = Keypair.generate();
    const user2 = Keypair.generate();

    // PDAs and token accounts
    let pdas;
    let adminTokenAccount: PublicKey;
    let user1TokenAccount: PublicKey;
    let user2TokenAccount: PublicKey;

    const INITIAL_BALANCE = TOKEN_PARAMS.mintAmount;

    before(async () => {
        // Calculate all PDAs for the token
        pdas = calculatePDAs(mint.publicKey, program.programId);

        // Fund test accounts
        const fundAccounts = [
            minter.publicKey,
            user1.publicKey,
            user2.publicKey,
        ];

        for (const account of fundAccounts) {
            await provider.connection.requestAirdrop(
                account,
                1 * anchor.web3.LAMPORTS_PER_SOL
            );
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log("Initializing token...");
        await initializeToken(program, provider, mint, pdas);

     let afterMintInfo=await transferAuthorityToPDA(pdas, mint, payer, provider)
      // Assertions to verify transfer
      assert(afterMintInfo.mintAuthority?.equals(pdas.mintAuthority), "Mint authority should be the PDA");
      assert(afterMintInfo.freezeAuthority?.equals(payer.publicKey), "Freeze authority should be the PDA");
        // Create token accounts
        const userAccounts = await setupUserAccounts(
            provider,
            [payer, user1, user2],
            mint.publicKey
        );

        [adminTokenAccount, user1TokenAccount, user2TokenAccount] = userAccounts;

        console.log("Token accounts created");

        // Mint tokens to all users
        await program.methods
            .addCanMint(minter.publicKey)
            .accounts({
                authority: provider.wallet.publicKey,
                tokenConfig: pdas.tokenConfig,
                blacklist: pdas.blacklist,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts,
            })
            .rpc();

        await program.methods
            .setMintAmount(minter.publicKey, INITIAL_BALANCE)
            .accounts({
                authority: provider.wallet.publicKey,
                tokenConfig: pdas.tokenConfig,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts
            })
            .rpc();

        // Mint to admin
        await program.methods
            .mint(INITIAL_BALANCE)
            .accounts({
                authority: minter.publicKey,
                tokenConfig: pdas.tokenConfig,
                mintAuthority: pdas.mintAuthority,
                mint: mint.publicKey,
                tokenAccount: adminTokenAccount,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                blacklist: pdas.blacklist,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts
            })
            .signers([minter])
            .rpc();

        // Re-add minter and mint to user1
        await program.methods
            .addCanMint(minter.publicKey)
            .accounts({
                authority: provider.wallet.publicKey,
                tokenConfig: pdas.tokenConfig,
                blacklist: pdas.blacklist,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts,
            })
            .rpc();

        await program.methods
            .setMintAmount(minter.publicKey, INITIAL_BALANCE)
            .accounts({
                authority: provider.wallet.publicKey,
                tokenConfig: pdas.tokenConfig,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts
            })
            .rpc();

        await program.methods
            .mint(INITIAL_BALANCE)
            .accounts({
                authority: minter.publicKey,
                tokenConfig: pdas.tokenConfig,
                mintAuthority: pdas.mintAuthority,
                mint: mint.publicKey,
                tokenAccount: user1TokenAccount,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                blacklist: pdas.blacklist,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts
            })
            .signers([minter])
            .rpc();

        // Re-add minter and mint to user2
        await program.methods
            .addCanMint(minter.publicKey)
            .accounts({
                authority: provider.wallet.publicKey,
                tokenConfig: pdas.tokenConfig,
                blacklist: pdas.blacklist,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts,
            })
            .rpc();

        await program.methods
            .setMintAmount(minter.publicKey, INITIAL_BALANCE)
            .accounts({
                authority: provider.wallet.publicKey,
                tokenConfig: pdas.tokenConfig,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts
            })
            .rpc();

        await program.methods
            .mint(INITIAL_BALANCE)
            .accounts({
                authority: minter.publicKey,
                tokenConfig: pdas.tokenConfig,
                mintAuthority: pdas.mintAuthority,
                mint: mint.publicKey,
                tokenAccount: user2TokenAccount,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                blacklist: pdas.blacklist,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts
            })
            .signers([minter])
            .rpc();

        console.log("All accounts funded with tokens");
    });

    it("Burns tokens from admin account using SPL burn", async () => {
        const initialBalance = (
            await getAccount(provider.connection, adminTokenAccount, null, TOKEN_2022_PROGRAM_ID)
        ).amount;
        const burnAmount = BigInt(initialBalance.toString()) / 4n;

        console.log(`Admin burning ${burnAmount.toString()} tokens...`);

        // Use SPL Token burn function
        await burn(
            provider.connection,
            payer, // Fee payer
            adminTokenAccount, // Account to burn from
            mint.publicKey, // Mint
            payer, // Owner of the token account
            burnAmount, // Amount to burn
            [], // Additional signers
            undefined, // Confirmation options
            TOKEN_2022_PROGRAM_ID // Token program
        );

        const updatedBalance = (
            await getAccount(provider.connection, adminTokenAccount, null, TOKEN_2022_PROGRAM_ID)
        ).amount;
        
        const expectedBalance = BigInt(initialBalance.toString()) - burnAmount;
        assert.equal(updatedBalance.toString(), expectedBalance.toString());
    });

    it("Burns tokens from user1 successfully", async () => {
        const initialBalance = (
            await getAccount(provider.connection, user1TokenAccount, null, TOKEN_2022_PROGRAM_ID)
        ).amount;
        const burnAmount = BigInt(initialBalance.toString()) / 4n;

        console.log(`User1 burning ${burnAmount.toString()} tokens...`);

        await burn(
            provider.connection,
            user1, // Fee payer and owner
            user1TokenAccount,
            mint.publicKey,
            user1, // Owner
            burnAmount,
            [],
            undefined,
            TOKEN_2022_PROGRAM_ID
        );

        const updatedBalance = (
            await getAccount(provider.connection, user1TokenAccount, null, TOKEN_2022_PROGRAM_ID)
        ).amount;
        
        const expectedBalance = BigInt(initialBalance.toString()) - burnAmount;
        assert.equal(updatedBalance.toString(), expectedBalance.toString());
    });

    it("Burns all remaining tokens from user1", async () => {
        const initialBalance = (
            await getAccount(provider.connection, user1TokenAccount, null, TOKEN_2022_PROGRAM_ID)
        ).amount;
        const remainingBalance = BigInt(initialBalance.toString());

        console.log(`Burning remaining ${remainingBalance.toString()} tokens from user1...`);

        await burn(
            provider.connection,
            user1,
            user1TokenAccount,
            mint.publicKey,
            user1,
            remainingBalance,
            [],
            undefined,
            TOKEN_2022_PROGRAM_ID
        );

        const finalBalance = (
            await getAccount(provider.connection, user1TokenAccount, null, TOKEN_2022_PROGRAM_ID)
        ).amount;
        assert.equal(finalBalance.toString(), "0");
    });

    it("Burns tokens from user2 successfully", async () => {
        const initialBalance = (
            await getAccount(provider.connection, user2TokenAccount, null, TOKEN_2022_PROGRAM_ID)
        ).amount;
        const burnAmount = BigInt(initialBalance.toString()) / 4n;

        console.log(`User2 burning ${burnAmount.toString()} tokens...`);

        await burn(
            provider.connection,
            user2,
            user2TokenAccount,
            mint.publicKey,
            user2,
            burnAmount,
            [],
            undefined,
            TOKEN_2022_PROGRAM_ID
        );

        const updatedBalance = (
            await getAccount(provider.connection, user2TokenAccount, null, TOKEN_2022_PROGRAM_ID)
        ).amount;
        
        const expectedBalance = BigInt(initialBalance.toString()) - burnAmount;
        assert.equal(updatedBalance.toString(), expectedBalance.toString());
    });

    it("Prevents user1 from burning tokens from user2's account", async () => {
        console.log("Testing unauthorized burn attempt...");
        try {
            await burn(
                provider.connection,
                user1, // Fee payer
                user2TokenAccount, // User2's account
                mint.publicKey,
                user1, // Wrong owner (user1 trying to burn user2's tokens)
                1000000n,
                [],
                undefined,
                TOKEN_2022_PROGRAM_ID
            );

            assert.fail("User1 should not be able to burn User2's tokens");
        } catch (error) {
            console.log("Caught expected error:", error.toString());
            assert.include(error.toString(), "owner does not match");
        }
    });

    it("Fails to burn more tokens than available", async () => {
        console.log("Testing burning more tokens than available...");
        try {
            await burn(
                provider.connection,
                user2,
                user2TokenAccount,
                mint.publicKey,
                user2,
                10000000000n, // Way more than available
                [],
                undefined,
                TOKEN_2022_PROGRAM_ID
            );

            assert.fail("Burning should have failed due to insufficient balance");
        } catch (error) {
            console.log("Caught expected error:", error.toString());
            assert.include(error.toString(), "insufficient");
        }
    });
});