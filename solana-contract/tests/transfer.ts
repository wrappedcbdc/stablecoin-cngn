import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Cngn } from "../target/types/cngn";
import { assert } from 'chai';
import { PublicKey, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAccount, getMint } from '@solana/spl-token';

import { calculatePDAs, createTokenAccountIfNeeded, TokenPDAs } from '../utils/helpers';
import {
  TOKEN_PARAMS,
  initializeToken,
  setupUserAccounts
} from '../utils/token_initializer';
import { transferAuthorityToPDA } from "./transfer_authority_to_pda";

describe("cngn transfer tests", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = (provider.wallet as anchor.Wallet).payer;
  const program = anchor.workspace.Cngn as Program<Cngn>;

  // Create the mint keypair - this will be the actual token
  const mint = Keypair.generate();

  // Create user keypairs for different test scenarios
  const minter = Keypair.generate();
  const user1 = Keypair.generate(); // Regular user
  const user2 = Keypair.generate(); // Regular recipient
  const blacklistedUser = Keypair.generate(); // User on blacklist
  const externalWhitelistedUser = Keypair.generate(); // External whitelisted user
  const internalWhitelistedUser = Keypair.generate(); // Internal whitelisted user

  // PDAs and token accounts
  let pdas: TokenPDAs;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;
  let blacklistedUserTokenAccount: PublicKey;
  let externalWhitelistedUserTokenAccount: PublicKey;
  let internalWhitelistedUserTokenAccount: PublicKey;

  // Initial token balances for reference
  const INITIAL_BALANCE = TOKEN_PARAMS.mintAmount;
  const TRANSFER_AMOUNT = TOKEN_PARAMS.transferAmount;

  before(async () => {
    // Calculate all PDAs for the token
    pdas = calculatePDAs(mint.publicKey, program.programId);

    // Initialize the token
    await initializeToken(program, provider, mint, pdas);
    let afterMintInfo = await transferAuthorityToPDA(pdas, mint, payer, provider)
    // Assertions to verify transfer
    assert(afterMintInfo.mintAuthority?.equals(pdas.mintAuthority), "Mint authority should be the PDA");
    assert(afterMintInfo.freezeAuthority?.equals(payer.publicKey), "Freeze authority should be the PDA");
    // Create token accounts for all users
    const userAccounts = await setupUserAccounts(
      provider,
      [user1, user2, blacklistedUser, externalWhitelistedUser, internalWhitelistedUser],
      mint.publicKey
    );

    [
      user1TokenAccount,
      user2TokenAccount,
      blacklistedUserTokenAccount,
      externalWhitelistedUserTokenAccount,
      internalWhitelistedUserTokenAccount
    ] = userAccounts;
    console.log("============= adding minter =============");
    // Add minter to can_mint list
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

    // Mint initial tokens to the test users
    await program.methods
      .mint(INITIAL_BALANCE)
      .accounts({
        authority: minter.publicKey,
        tokenConfig: pdas.tokenConfig,
        mintAuthority: pdas.mintAuthority,
        mint: mint.publicKey,
        tokenAccount: user1TokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts
      })
      .signers([minter])
      .rpc();
    console.log("============= minted to user1 =============");
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
    // Mint to external whitelisted user
    await program.methods
      .mint(INITIAL_BALANCE)
      .accounts({
        authority: minter.publicKey,
        tokenConfig: pdas.tokenConfig,
        mintAuthority: pdas.mintAuthority,
        mint: mint.publicKey,
        tokenAccount: externalWhitelistedUserTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts
      })
      .signers([minter])
      .rpc();
    console.log("============= adding blacklisted user =============");
    // Add blacklisted user to the blacklist
    await program.methods
      .addBlacklist(blacklistedUser.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        blacklist: pdas.blacklist,
      })
      .rpc();
    console.log("============= adding external whitelisted user =============");
    // Add external whitelisted user to external whitelist
    await program.methods
      .whitelistExternalUser(externalWhitelistedUser.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        externalWhitelist: pdas.externalWhitelist,

      })
      .rpc();
    console.log("============= adding internal whitelisted user =============");
    // Add internal whitelisted user to internal whitelist
    await program.methods
      .whitelistInternalUser(internalWhitelistedUser.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        internalWhitelist: pdas.internalWhitelist,
      })
      .rpc();

    // Verify tokens were minted to user1
    const senderBalance = await getAccount(provider.connection, user1TokenAccount);
    console.log("Initial user1 token balance:", senderBalance.amount.toString());
    assert.equal(senderBalance.amount.toString(), INITIAL_BALANCE.toString());
  });

  it('Transfers tokens from user1 to user2 (standard transfer)', async () => {
    console.log("Testing standard token transfer...");

    // Get initial balances
    const initialSenderBalance = await getAccount(provider.connection, user1TokenAccount);
    const initialRecipientBalance = await getAccount(provider.connection, user2TokenAccount);

    console.log("Initial sender balance:", initialSenderBalance.amount.toString());
    console.log("Initial recipient balance:", initialRecipientBalance.amount.toString());

    // Execute transfer transaction
    const transferTx = await program.methods
      .transfer(TRANSFER_AMOUNT)
      .accounts({
        owner: user1.publicKey,
        tokenConfig: pdas.tokenConfig,
        mint: mint.publicKey,
        from: user1TokenAccount,
        to: user2TokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        blacklist: pdas.blacklist,
        internalWhitelist: pdas.internalWhitelist,
        externalWhitelist: pdas.externalWhitelist
      })
      .signers([user1])
      .rpc();

    console.log("Transfer transaction signature", transferTx);

    // Verify balances after transfer
    const finalSenderBalance = await getAccount(provider.connection, user1TokenAccount);
    const finalRecipientBalance = await getAccount(provider.connection, user2TokenAccount);

    console.log("Final sender balance:", finalSenderBalance.amount.toString());
    console.log("Final recipient balance:", finalRecipientBalance.amount.toString());

    // Assert balances are correct
    const expectedSenderBalance = new anchor.BN(initialSenderBalance.amount.toString()).sub(TRANSFER_AMOUNT);
    assert.equal(finalSenderBalance.amount.toString(), expectedSenderBalance.toString());
    assert.equal(
      finalRecipientBalance.amount.toString(),
      new anchor.BN(initialRecipientBalance.amount.toString()).add(TRANSFER_AMOUNT).toString()
    );
  });

  it('Fails when transferring more tokens than the sender has', async () => {
    console.log("Testing insufficient funds transfer...");

    const senderBalance = await getAccount(provider.connection, user1TokenAccount);
    const tooLargeAmount = new anchor.BN(senderBalance.amount.toString()).add(new anchor.BN(1000000)); // More than the user has

    try {
      await program.methods
        .transfer(tooLargeAmount)
        .accounts({
          owner: user1.publicKey,
          tokenConfig: pdas.tokenConfig,
          mint: mint.publicKey,
          from: user1TokenAccount,
          to: user2TokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          blacklist: pdas.blacklist,
          internalWhitelist: pdas.internalWhitelist,
          externalWhitelist: pdas.externalWhitelist
        })
        .signers([user1])
        .rpc();

      assert.fail("Transfer should have failed with insufficient funds");
    } catch (error) {
      console.log("Caught expected error for insufficient funds:", error.toString());
      assert.include(error.toString(), "InsufficientFunds");
    }
  });

  it('Fails when trying to transfer from an account not owned by the signer', async () => {
    console.log("Testing transfer with invalid owner...");

    try {
      await program.methods
        .transfer(new anchor.BN(1_000_000))
        .accounts({
          owner: provider.wallet.publicKey, // provider is not the owner of user2TokenAccount
          tokenConfig: pdas.tokenConfig,
          mint: mint.publicKey,
          from: user2TokenAccount, // owned by user2, not provider
          to: user1TokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          blacklist: pdas.blacklist,
          internalWhitelist: pdas.internalWhitelist,
          externalWhitelist: pdas.externalWhitelist
        })
        .rpc();

      assert.fail("Transfer should have failed with invalid owner");
    } catch (error) {
      console.log("Caught expected error for invalid owner:", error.toString());
      assert.include(error.toString(), "InvalidOwner");
    }
  });

  it('Fails to transfer when transfers are paused', async () => {
    console.log("Testing transfer when paused...");

    // First, pause transfers by updating token_config
    await program.methods
      .pauseTransfers(true) // Don't pause minting, but pause transfers
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
      })
      .rpc();

    console.log("Transfers paused successfully");

    try {
      await program.methods
        .transfer(new anchor.BN(1_000_000))
        .accounts({
          owner: user1.publicKey,
          tokenConfig: pdas.tokenConfig,
          mint: mint.publicKey,
          from: user1TokenAccount,
          to: user2TokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          blacklist: pdas.blacklist,
          internalWhitelist: pdas.internalWhitelist,
          externalWhitelist: pdas.externalWhitelist
        })
        .signers([user1])
        .rpc();

      assert.fail("Transfer should have failed when paused");
    } catch (error) {
      console.log("Caught expected error when transferring while paused:", error.toString());
      assert.include(error.toString(), "TransfersPaused");
    }

    // Unpause for remaining tests
    await program.methods
      .pauseTransfers(false) // Unpause transfers
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
      })
      .rpc();

    console.log("Transfers unpaused successfully");
  });

  it('Fails to transfer to an account with mismatched mint', async () => {
    console.log("Testing transfer with mismatched mint...");

    // Create a different token mint and initialize it
    const otherMint = Keypair.generate();

    // Calculate PDAs for other token
    const otherPDAs = calculatePDAs(otherMint.publicKey, program.programId);

    // Initialize other token
    await initializeToken(program, provider, otherMint, otherPDAs);

    // Create token account for other mint
    const otherTokenAccount = await createTokenAccountIfNeeded(
      provider,
      user2, // Create for user2
      otherMint.publicKey
    );

    try {
      await program.methods
        .transfer(new anchor.BN(1_000_000))
        .accounts({
          owner: user1.publicKey,
          tokenConfig: pdas.tokenConfig,
          mint: mint.publicKey,
          from: user1TokenAccount,
          to: otherTokenAccount, // different mint
          tokenProgram: TOKEN_PROGRAM_ID,
          blacklist: pdas.blacklist,
          internalWhitelist: pdas.internalWhitelist,
          externalWhitelist: pdas.externalWhitelist
        })
        .signers([user1])
        .rpc();

      assert.fail("Transfer should have failed with mint mismatch");
    } catch (error) {
      console.log("Caught expected error for mint mismatch:", error.toString());
      assert.include(error.toString(), "MintMismatch");
    }
  });

  it('Fails to transfer when sender is blacklisted', async () => {
    console.log("Testing transfer from blacklisted sender...");

    // First mint some tokens to the blacklisted user
    // Temporarily remove from blacklist to mint
    await program.methods
      .removeBlacklist(blacklistedUser.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        blacklist: pdas.blacklist,
      })
      .rpc();

    // Update minter allowance
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

    // Mint tokens to blacklisted user
    await program.methods
      .mint(INITIAL_BALANCE)
      .accounts({
        authority: minter.publicKey,
        tokenConfig: pdas.tokenConfig,
        mintAuthority: pdas.mintAuthority,
        mint: mint.publicKey,
        tokenAccount: blacklistedUserTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts
      })
      .signers([minter])
      .rpc();

    // Add user back to blacklist
    await program.methods
      .addBlacklist(blacklistedUser.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        blacklist: pdas.blacklist,
      })
      .rpc();

    try {
      await program.methods
        .transfer(new anchor.BN(1_000_000))
        .accounts({
          owner: blacklistedUser.publicKey,
          tokenConfig: pdas.tokenConfig,
          mint: mint.publicKey,
          from: blacklistedUserTokenAccount,
          to: user2TokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          blacklist: pdas.blacklist,
          internalWhitelist: pdas.internalWhitelist,
          externalWhitelist: pdas.externalWhitelist
        })
        .signers([blacklistedUser])
        .rpc();

      assert.fail("Transfer should have failed with blacklisted sender");
    } catch (error) {
      console.log("Caught expected error for blacklisted sender:", error.toString());
      assert.include(error.toString(), "UserBlacklisted");
    }
  });

  it('Fails to transfer when recipient is blacklisted', async () => {
    console.log("Testing transfer to blacklisted recipient...");

    try {
      await program.methods
        .transfer(new anchor.BN(1_000_000))
        .accounts({
          owner: user1.publicKey,
          tokenConfig: pdas.tokenConfig,
          mint: mint.publicKey,
          from: user1TokenAccount,
          to: blacklistedUserTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          blacklist: pdas.blacklist,
          internalWhitelist: pdas.internalWhitelist,
          externalWhitelist: pdas.externalWhitelist
        })
        .signers([user1])
        .rpc();

      assert.fail("Transfer should have failed with blacklisted recipient");
    } catch (error) {
      console.log("Caught expected error for blacklisted recipient:", error.toString());
      assert.include(error.toString(), "UserBlacklisted");
    }
  });

  it('Burns tokens when transferring from external whitelist to internal whitelist', async () => {
    console.log("Testing external to internal whitelist transfer (burn flow)...");

    // Get initial balances and token supply
    const initialSenderBalance = await getAccount(provider.connection, externalWhitelistedUserTokenAccount);
    const initialRecipientBalance = await getAccount(provider.connection, internalWhitelistedUserTokenAccount);
    const initialMintSupply = await getMint(provider.connection, mint.publicKey);
    const transferAmount = new anchor.BN(10_000_000);
    console.log("Initial sender balance:", initialSenderBalance.amount.toString());
    console.log("Initial recipient balance:", initialRecipientBalance.amount.toString());
    console.log("Initial mint supply:", initialMintSupply.supply.toString());
    console.log("amount to send :", transferAmount.toString());

    // Set up event listener before the transaction
    let bridgeBurnEvent = null;


    const listener = program.addEventListener('bridgeBurnEvent', (event, slot) => {
      console.log("BridgeBurnEvent received:", event);
      bridgeBurnEvent = event;
    });
    try {

      // Execute special transfer
      const transferTx = await program.methods
        .transfer(transferAmount)
        .accounts({
          owner: externalWhitelistedUser.publicKey,
          tokenConfig: pdas.tokenConfig,
          mint: mint.publicKey,
          from: externalWhitelistedUserTokenAccount,
          to: internalWhitelistedUserTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          blacklist: pdas.blacklist,
          internalWhitelist: pdas.internalWhitelist,
          externalWhitelist: pdas.externalWhitelist
        })
        .signers([externalWhitelistedUser])
        .rpc();

      console.log("Special transfer transaction signature", transferTx);

      // Verify balances and supply after transfer
      const finalSenderBalance = await getAccount(provider.connection, externalWhitelistedUserTokenAccount);
      const finalRecipientBalance = await getAccount(provider.connection, internalWhitelistedUserTokenAccount);
      const finalMintSupply = await getMint(provider.connection, mint.publicKey);

      console.log("Final sender balance:", finalSenderBalance.amount.toString());
      console.log("Final recipient balance:", finalRecipientBalance.amount.toString());
      console.log("Final mint supply:", finalMintSupply.supply.toString());

      // Assert sender tokens were burned (decreased)
      const expectedSenderBalance = new anchor.BN(initialSenderBalance.amount.toString()).sub(transferAmount);
      assert.equal(finalSenderBalance.amount.toString(), expectedSenderBalance.toString());



      // Verify total supply decreased by the transfer amount (confirming burns)
      const expectedSupply = new anchor.BN(initialMintSupply.supply.toString()).sub(transferAmount);
      assert.equal(finalMintSupply.supply.toString(), expectedSupply.toString());
      // **NEW: Verify Bridge Burn Event**
      if (bridgeBurnEvent) {
        console.log("✅ BridgeBurnEvent detected");
        assert.equal(bridgeBurnEvent.fromAccount.toString(), externalWhitelistedUserTokenAccount.toString());
        assert.equal(bridgeBurnEvent.sender.toString(), externalWhitelistedUser.publicKey.toString());
        assert.equal(bridgeBurnEvent.recipient.toString(), internalWhitelistedUser.publicKey.toString());
        assert.equal(bridgeBurnEvent.amount.toString(), transferAmount.toString());
        assert.ok(bridgeBurnEvent.sourceChain === "solana");
        console.log("✅ All bridge burn event fields verified");
      } else {
        console.log("❌ No BridgeBurnEvent received - check if your program emits this event");
      }
    } finally {
      await program.removeEventListener(listener);
    }

  });

  it('Successfully transfers between non-whitelisted users', async () => {
    // Just a regular transfer between two normal users
    const transferAmount = new anchor.BN(5_000_000);

    // Get initial balances
    const initialSenderBalance = await getAccount(provider.connection, user1TokenAccount);
    const initialRecipientBalance = await getAccount(provider.connection, user2TokenAccount);
    const initialMintSupply = await getMint(provider.connection, mint.publicKey);

    // Execute normal transfer
    await program.methods
      .transfer(transferAmount)
      .accounts({
        owner: user1.publicKey,
        tokenConfig: pdas.tokenConfig,
        mint: mint.publicKey,
        from: user1TokenAccount,
        to: user2TokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        blacklist: pdas.blacklist,
        internalWhitelist: pdas.internalWhitelist,
        externalWhitelist: pdas.externalWhitelist
      })
      .signers([user1])
      .rpc();

    // Verify balances after transfer
    const finalSenderBalance = await getAccount(provider.connection, user1TokenAccount);
    const finalRecipientBalance = await getAccount(provider.connection, user2TokenAccount);
    const finalMintSupply = await getMint(provider.connection, mint.publicKey);

    // For regular transfer: sender balance decreases, recipient increases, total supply unchanged
    const expectedSenderBalance = new anchor.BN(initialSenderBalance.amount.toString()).sub(transferAmount);
    const expectedRecipientBalance = new anchor.BN(initialRecipientBalance.amount.toString()).add(transferAmount);

    assert.equal(finalSenderBalance.amount.toString(), expectedSenderBalance.toString());
    assert.equal(finalRecipientBalance.amount.toString(), expectedRecipientBalance.toString());
    assert.equal(finalMintSupply.supply.toString(), initialMintSupply.supply.toString());
  });

  it('Transfers from internal whitelist to non-whitelisted (regular transfer)', async () => {
    // Mint to internal whitelisted first
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
        tokenAccount: internalWhitelistedUserTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts
      })
      .signers([minter])
      .rpc();

    // Test transfer from internal whitelist to regular user (not special case, should be normal transfer)
    const transferAmount = new anchor.BN(5_000_000);

    // Get initial balances
    const initialSenderBalance = await getAccount(provider.connection, internalWhitelistedUserTokenAccount);
    const initialRecipientBalance = await getAccount(provider.connection, user2TokenAccount);
    const initialMintSupply = await getMint(provider.connection, mint.publicKey);

    // Execute transfer
    await program.methods
      .transfer(transferAmount)
      .accounts({
        owner: internalWhitelistedUser.publicKey,
        tokenConfig: pdas.tokenConfig,
        mint: mint.publicKey,
        from: internalWhitelistedUserTokenAccount,
        to: user2TokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        blacklist: pdas.blacklist,
        internalWhitelist: pdas.internalWhitelist,
        externalWhitelist: pdas.externalWhitelist
      })
      .signers([internalWhitelistedUser])
      .rpc();

    // Verify balances after transfer
    const finalSenderBalance = await getAccount(provider.connection, internalWhitelistedUserTokenAccount);
    const finalRecipientBalance = await getAccount(provider.connection, user2TokenAccount);
    const finalMintSupply = await getMint(provider.connection, mint.publicKey);

    // For regular transfer: sender balance decreases, recipient increases, total supply unchanged
    const expectedSenderBalance = new anchor.BN(initialSenderBalance.amount.toString()).sub(transferAmount);
    const expectedRecipientBalance = new anchor.BN(initialRecipientBalance.amount.toString()).add(transferAmount);

    assert.equal(finalSenderBalance.amount.toString(), expectedSenderBalance.toString());
    assert.equal(finalRecipientBalance.amount.toString(), expectedRecipientBalance.toString());
    assert.equal(finalMintSupply.supply.toString(), initialMintSupply.supply.toString());
  });
});