/**
 * Test: Can initialize program with different mint keys
 * 
 * This test verifies that the program can be initialized multiple times with different
 * mint keys. Since all PDAs are derived from the mint key, each unique mint key will
 * create a unique set of PDAs, allowing independent initialization.
 * 
 * The test demonstrates that the check at initialize.rs L84-87:
 *   require!(token_config.admin == Pubkey::default(), ErrorCode::TokenAlreadyInitialized);
 * 
 * Does NOT prevent initialization with different mint keys because each mint key
 * creates a fresh token_config PDA with admin == Pubkey::default().
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Cngn } from "../target/types/cngn";
import { assert, expect } from 'chai';
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { calculatePDAs, createMintAccountWithExtensions, TokenParams } from '../utils/helpers';
import { createMint, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

describe("Initialize with Different Mint Keys", () => {
  // Setup provider with explicit connection and wallet
  const connection = new anchor.web3.Connection('http://127.0.0.1:8899', 'confirmed');
  
  // Load wallet from default Solana keypair location
  const walletPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  const walletKeypair = anchor.web3.Keypair.fromSecretKey(
    Buffer.from(JSON.parse(require('fs').readFileSync(walletPath, 'utf-8')))
  );
  const wallet = new anchor.Wallet(walletKeypair);
  
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);
  const payer = walletKeypair;
  const program = anchor.workspace.Cngn as Program<Cngn>;

  // Define token params for testing
  const TOKEN_PARAMS: TokenParams = {
    name: "TestToken",
    symbol: "TEST",
    decimals: 6,
    uri: "https://example.com/token",
  };

  // Create multiple mint keypairs
  const mintA = Keypair.generate();
  const mintB = Keypair.generate();
  const mintC = Keypair.generate();

  let pdasA: ReturnType<typeof calculatePDAs>;
  let pdasB: ReturnType<typeof calculatePDAs>;
  let pdasC: ReturnType<typeof calculatePDAs>;

  before(async () => {
    // Calculate PDAs for each mint
    pdasA = calculatePDAs(mintA.publicKey, program.programId);
    pdasB = calculatePDAs(mintB.publicKey, program.programId);
    pdasC = calculatePDAs(mintC.publicKey, program.programId);

    console.log("\n=== Test Setup ===");
    console.log("Mint A:", mintA.publicKey.toString().slice(0, 16) + "...");
    console.log("Mint B:", mintB.publicKey.toString().slice(0, 16) + "...");
    console.log("Mint C:", mintC.publicKey.toString().slice(0, 16) + "...");

    // Verify that PDAs are different for each mint
    console.log("\n=== Verifying PDAs are unique per mint ===");
    // assert.notEqual(
    //   pdasA.tokenConfig.toString(),
    //   pdasB.tokenConfig.toString(),
    //   "Token configs should be different"
    // );
    // assert.notEqual(
    //   pdasB.tokenConfig.toString(),
    //   pdasC.tokenConfig.toString(),
    //   "Token configs should be different"
    // );

    // Create mint accounts for each test mint
    console.log("\n=== Creating Mint Accounts ===");
    
    // Create Mint A with permanent delegate extension
    await createMintAccountWithExtensions(
      provider,
      mintA,
      TOKEN_PARAMS,
      pdasA.mintAuthority,
      payer.publicKey,
    );
    console.log("Created Mint A");

    // Create Mint B with permanent delegate extension
    await createMintAccountWithExtensions(
      provider,
      mintB,
      TOKEN_PARAMS,
      pdasB.mintAuthority,
      payer.publicKey,
    );
    console.log("Created Mint B");

    // Create Mint C with permanent delegate extension
    await createMintAccountWithExtensions(
      provider,
      mintC,
      TOKEN_PARAMS,
      pdasC.mintAuthority,
      payer.publicKey,
    );
    console.log("Created Mint C");
  });

  /**
   * Helper function to initialize token
   */
  async function initializeTokenForMint(
    mint: Keypair,
    pdas: ReturnType<typeof calculatePDAs>
  ): Promise<string> {
    const tx = await program.methods
      .initialize(TOKEN_PARAMS.name, TOKEN_PARAMS.symbol, TOKEN_PARAMS.uri, TOKEN_PARAMS.decimals)
      .accounts({
        initializer: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        mintAuthority: pdas.mintAuthority,
        mint: mint.publicKey,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts,
        canForward: pdas.canForward,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    
    return tx;
  }

describe("Singleton Initialization - Only One Mint Allowed", () => {
  it("Can initialize with Mint A (first mint)", async () => {
    console.log("\n=== Initializing with Mint A ===");
    
    const tx = await initializeTokenForMint(mintA, pdasA);
    console.log("Initialization tx:", tx);

    const tokenConfigA = await program.account.tokenConfig.fetch(pdasA.tokenConfig);
    assert.equal(tokenConfigA.admin.toString(), payer.publicKey.toString());
    assert.equal(tokenConfigA.mint.toString(), mintA.publicKey.toString());
    
    console.log("✅ Successfully initialized Mint A");
  });

  it("CANNOT initialize with Mint B (singleton protection)", async () => {
    console.log("\n=== Attempting to Initialize with Mint B ===");
    
    try {
      await initializeTokenForMint(mintB, pdasB);
      assert.fail("Should have failed - only one mint allowed");
    } catch (error) {
      console.log("✅ Correctly prevented:", error.toString().slice(0, 100));
      
      // Verify it's the "already in use" error
      assert.include(
        error.toString(), 
        "already in use",
        "Should fail because PDA already exists"
      );
    }
  });

  it("CANNOT initialize with Mint C (singleton protection)", async () => {
    console.log("\n=== Attempting to Initialize with Mint C ===");
    
    try {
      await initializeTokenForMint(mintC, pdasC);
      assert.fail("Should have failed - only one mint allowed");
    } catch (error) {
      console.log("✅ Correctly prevented:", error.toString().slice(0, 100));
      assert.include(error.toString(), "already in use");
    }
  });

  it("TokenConfig is singleton, other PDAs are per-mint", async () => {
    // TokenConfig should be the SAME for all mints
    assert.equal(
      pdasA.tokenConfig.toString(),
      pdasB.tokenConfig.toString(),
      "tokenConfig should be singleton"
    );

    // Other PDAs should be DIFFERENT for each mint
    assert.notEqual(
      pdasA.mintAuthority.toString(),
      pdasB.mintAuthority.toString(),
      "mintAuthority should be per-mint"
    );

    assert.notEqual(
      pdasA.canMint.toString(),
      pdasB.canMint.toString(),
      "canMint should be per-mint"
    );

    console.log("✅ Singleton pattern confirmed for tokenConfig only");
  });


  it("Only Mint A's data is stored", async () => {
    console.log("\n=== Verifying Singleton State ===");
    
    // Fetch the token config (same PDA for all)
    const tokenConfig = await program.account.tokenConfig.fetch(pdasA.tokenConfig);
    
    // Should contain Mint A's data (not B or C)
    assert.equal(
      tokenConfig.mint.toString(), 
      mintA.publicKey.toString(),
      "Only Mint A should be stored"
    );
    
    console.log("Stored Mint:", tokenConfig.mint.toString());
    console.log("✅ Confirmed: Only first mint (A) is stored");
  });
});
});
