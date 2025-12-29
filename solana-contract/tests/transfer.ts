import * as anchor from "@coral-xyz/anchor";
import { BorshCoder, EventParser, Program } from "@coral-xyz/anchor";
import { Cngn } from "../target/types/cngn";
import { assert, expect } from 'chai';
import { PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, burn, createTransferCheckedInstruction, createTransferCheckedWithTransferHookInstruction, getAccount, getExtraAccountMetaAddress, getExtraAccountMetas, getMint, getTransferHook, transfer, transferChecked } from '@solana/spl-token';

import { calculatePDAs, createTokenAccountIfNeeded, TokenPDAs } from '../utils/helpers';
import {
  TOKEN_PARAMS,
  initializeToken,
  setupUserAccounts
} from '../utils/token_initializer';
import { transferAuthorityToPDA } from "./transfer-authority-to-pda";

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
    await initializeToken(program, provider, mint, pdas, payer.publicKey);
    let users = [user1, user2, blacklistedUser, externalWhitelistedUser, internalWhitelistedUser, minter];

    for (const user of users) {
      const airdropSignature = await provider.connection.requestAirdrop(
        user.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSignature);
    }

    // Create token accounts for all users
    const userAccounts = await setupUserAccounts(
      provider,
      users,
      mint.publicKey
    );

    [
      user1TokenAccount,
      user2TokenAccount,
      blacklistedUserTokenAccount,
      externalWhitelistedUserTokenAccount,
      internalWhitelistedUserTokenAccount,
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
        tokenProgram: TOKEN_2022_PROGRAM_ID,
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
        tokenProgram: TOKEN_2022_PROGRAM_ID,
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
        tokenProgram: TOKEN_2022_PROGRAM_ID
      })
      .rpc();

    // Verify tokens were minted to user1
    const senderBalance = await getAccount(provider.connection, user1TokenAccount, null, TOKEN_2022_PROGRAM_ID);
    console.log("Initial user1 token balance:", senderBalance.amount.toString());
    assert.equal(senderBalance.amount.toString(), INITIAL_BALANCE.toString());


  });

  it('Transfers tokens from user1 to user2 (standard transfer)', async () => {
    console.log("Testing standard token transfer...");

    // Get initial balances
    const initialSenderBalance = await getAccount(provider.connection, user1TokenAccount, null, TOKEN_2022_PROGRAM_ID);
    const initialRecipientBalance = await getAccount(provider.connection, user2TokenAccount, null, TOKEN_2022_PROGRAM_ID);

    console.log("Initial sender balance:", initialSenderBalance.amount.toString());
    console.log("Initial recipient balance:", initialRecipientBalance.amount.toString());

    // Execute transfer transaction
    let transferTx = await createTransferCheckedInstruction(
      user1TokenAccount, // Transfer from
      mint.publicKey,
      user2TokenAccount, // Transfer to
      user1.publicKey, // Source Token Account owner
      TRANSFER_AMOUNT as any,  // Amount
      6,
      undefined, // Additional signers
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    const tx = new anchor.web3.Transaction().add(transferTx);

    await provider.sendAndConfirm(tx, [user1]);

    // Verify balances after transfer
    const finalSenderBalance = await getAccount(provider.connection, user1TokenAccount, null, TOKEN_2022_PROGRAM_ID);
    const finalRecipientBalance = await getAccount(provider.connection, user2TokenAccount, null, TOKEN_2022_PROGRAM_ID);

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

    const senderBalance = await getAccount(provider.connection, user1TokenAccount, null, TOKEN_2022_PROGRAM_ID);
    const tooLargeAmount = new anchor.BN(senderBalance.amount.toString()).add(new anchor.BN(1000000)); // More than the user has

    try {

      let transferTx = await createTransferCheckedInstruction(
        user1TokenAccount, // Transfer from
        mint.publicKey,
        user2TokenAccount, // Transfer to
        user1.publicKey, // Source Token Account owner
        tooLargeAmount,  // Amount
        6,
        undefined, // Additional signers
        TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
      );

      const tx = new anchor.web3.Transaction().add(transferTx);

      await provider.sendAndConfirm(tx, [user1]);

      assert.fail("Transfer should have failed with insufficient funds");
    } catch (error) {
      assert.include(error.toString(), "insufficient funds");
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
      // Execute transfer transaction
      let transferTx = await createTransferCheckedWithTransferHookInstruction(
        provider.connection,
        user1TokenAccount, // Transfer from
        mint.publicKey,
        user2TokenAccount, // Transfer to
        user1.publicKey, // Source Token Account owner
        TRANSFER_AMOUNT as any,  // Amount
        6,
        undefined, // Additional signers
        undefined, // Confirmation options
        TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
      );


      const tx = new anchor.web3.Transaction().add(transferTx);

      await provider.sendAndConfirm(tx, [user1]);

      console.log("Transfer transaction signature", transferTx);

      assert.fail("Transfer should have failed when paused");
    } catch (error) {
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

  // it('Fails to transfer to an account with mismatched mint', async () => {
  //   console.log("Testing transfer with mismatched mint...");

  //   // Create a different token mint and initialize it
  //   const otherMint = Keypair.generate();

  //   // Calculate PDAs for other token
  //   const otherPDAs = calculatePDAs(otherMint.publicKey, program.programId);

  //   //Initialize other token
  //   await initializeToken(program, provider, otherMint, otherPDAs, payer.publicKey);

  //   // Create token account for other mint
  //   const otherTokenAccount = await createTokenAccountIfNeeded(
  //     provider,
  //     user2, // Create for user2
  //     otherMint.publicKey
  //   );

  //   try {
  //     // Execute transfer transaction
  //     let transferTx = await createTransferCheckedInstruction(
  //       user1TokenAccount, // Transfer from
  //       mint.publicKey,
  //       otherTokenAccount, // Transfer to
  //       user1.publicKey, // Source Token Account owner
  //       TRANSFER_AMOUNT as any,  // Amount
  //       6,
  //       undefined, // Additional signers
  //       TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
  //     );


  //     const tx = new anchor.web3.Transaction().add(transferTx);

  //     await provider.sendAndConfirm(tx, [user1]);

  //     console.log("Transfer transaction signature", transferTx);

  //     assert.fail("Transfer should have failed with mint mismatch");
  //   } catch (error) {
  //     expect(
  //       error.toString().includes("MintMismatch") ||
  //       error.toString().includes("Account not associated with this Mint")
  //     ).to.be.true;

  //   }
  // });

  // it('Fails to transfer when sender is blacklisted', async () => {
  //   console.log("Testing transfer from blacklisted sender...");

  //   // First mint some tokens to the blacklisted user
  //   // Temporarily remove from blacklist to mint
  //   await program.methods
  //     .removeBlacklist(blacklistedUser.publicKey)
  //     .accounts({
  //       authority: provider.wallet.publicKey,
  //       tokenConfig: pdas.tokenConfig,
  //       blacklist: pdas.blacklist,
  //     })
  //     .rpc();

  //   // Update minter allowance
  //   await program.methods
  //     .addCanMint(minter.publicKey)
  //     .accounts({
  //       authority: provider.wallet.publicKey,
  //       tokenConfig: pdas.tokenConfig,
  //       blacklist: pdas.blacklist,
  //       canMint: pdas.canMint,
  //       trustedContracts: pdas.trustedContracts,
  //     })
  //     .rpc();

  //   await program.methods
  //     .setMintAmount(minter.publicKey, INITIAL_BALANCE)
  //     .accounts({
  //       authority: provider.wallet.publicKey,
  //       tokenConfig: pdas.tokenConfig,
  //       canMint: pdas.canMint,
  //       trustedContracts: pdas.trustedContracts
  //     })
  //     .rpc();

  //   // Mint tokens to blacklisted user
  //   await program.methods
  //     .mint(INITIAL_BALANCE)
  //     .accounts({
  //       authority: minter.publicKey,
  //       tokenConfig: pdas.tokenConfig,
  //       mintAuthority: pdas.mintAuthority,
  //       mint: mint.publicKey,
  //       tokenAccount: blacklistedUserTokenAccount,
  //       tokenProgram: TOKEN_2022_PROGRAM_ID,
  //       blacklist: pdas.blacklist,
  //       canMint: pdas.canMint,
  //       trustedContracts: pdas.trustedContracts
  //     })
  //     .signers([minter])
  //     .rpc();

  //   // Add user back to blacklist
  //   await program.methods
  //     .addBlacklist(blacklistedUser.publicKey)
  //     .accounts({
  //       authority: provider.wallet.publicKey,
  //       tokenConfig: pdas.tokenConfig,
  //       blacklist: pdas.blacklist,
  //     })
  //     .rpc();

  //   try {
  //     // Execute transfer transaction

  //     let transferTx = await createTransferCheckedInstruction(
  //       blacklistedUserTokenAccount, // Transfer from
  //       mint.publicKey,
  //       user2TokenAccount, // Transfer to
  //       blacklistedUser.publicKey, // Source Token Account owner
  //       250,  // Amount
  //       6,
  //       undefined, // Additional signers
  //       TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
  //     );

  //     const tx = new anchor.web3.Transaction().add(transferTx);

  //     await provider.sendAndConfirm(tx, [blacklistedUser]);


  //     // Verify balances after transfer
  //     const finalSenderBalance = await getAccount(provider.connection, blacklistedUserTokenAccount, null, TOKEN_2022_PROGRAM_ID);
  //     const finalRecipientBalance = await getAccount(provider.connection, user2TokenAccount, null, TOKEN_2022_PROGRAM_ID);

  //     console.log("Final blacklisteduser balance:", finalSenderBalance.amount.toString());
  //     console.log("Final blacklisteduser recipient balance:", finalRecipientBalance.amount.toString());
  //     assert.fail("Transfer should have failed with blacklisted sender");
  //   } catch (error) {

  //     assert.include(error.toString(), "UserBlacklisted");
  //   }
  // });

  // it('Fails to transfer when recipient is blacklisted', async () => {
  //   console.log("Testing transfer to blacklisted recipient...");

  //   try {
  //     // Execute transfer transaction

  //     let transferTx = await createTransferCheckedInstruction(
  //       user1TokenAccount, // Transfer from
  //       mint.publicKey,
  //       blacklistedUserTokenAccount, // Transfer to
  //       user1.publicKey, // Source Token Account owner
  //       250,  // Amount
  //       6,
  //       undefined, // Additional signers
  //       TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
  //     );

  //     const tx = new anchor.web3.Transaction().add(transferTx);

  //     await provider.sendAndConfirm(tx, [user1]);

  //     assert.fail("Transfer should have failed with blacklisted recipient");
  //   } catch (error) {

  //     assert.include(error.toString(), "UserBlacklisted");
  //   }
  // });

  // it('Fails when trying to transfer from an account not owned by the signer', async () => {
  //   console.log("Testing transfer with invalid owner...");

  //   try {
  //     // Execute transfer transaction

  //     let transferTx = await createTransferCheckedInstruction(
  //       user1TokenAccount, // Transfer from
  //       mint.publicKey,
  //       user2TokenAccount, // Transfer to
  //       user2.publicKey, // Source Token Account owner
  //       250,  // Amount
  //       6,
  //       undefined, // Additional signers
  //       TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
  //     );

  //     const tx = new anchor.web3.Transaction().add(transferTx);

  //     await provider.sendAndConfirm(tx, [user2]);
  //     assert.fail("Transfer should have failed with invalid owner");
  //   } catch (error) {

  //     assert.include(error.toString(), "owner does not match");
  //   }
  // });


  it('Burns tokens when transferring from external whitelist to internal whitelist', async () => {
    console.log("Testing external to internal whitelist transfer (burn flow)...");

    // Get initial balances and token supply
    const initialSenderBalance = await getAccount(provider.connection, externalWhitelistedUserTokenAccount, null, TOKEN_2022_PROGRAM_ID);
    const initialRecipientBalance = await getAccount(provider.connection, internalWhitelistedUserTokenAccount, null, TOKEN_2022_PROGRAM_ID);
    const initialMintSupply = await getMint(provider.connection, mint.publicKey, null, TOKEN_2022_PROGRAM_ID);

    console.log("Initial sender balance:", initialSenderBalance.amount.toString());
    console.log("Initial recipient balance:", initialRecipientBalance.amount.toString());
    console.log("Initial mint supply:", initialMintSupply.supply.toString());

    // Execute redemption tranfer
    let transferTx =  await program.methods
      .bridgeToken(TRANSFER_AMOUNT)
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        externalWhitelist: pdas.externalWhitelist,
        blacklist: pdas.blacklist,
        internalWhitelist: pdas.internalWhitelist,
        tokenProgram: TOKEN_2022_PROGRAM_ID
      })
      .rpc();

    const tx = new anchor.web3.Transaction().add(transferTx);

    const txSignature = await provider.sendAndConfirm(tx, [externalWhitelistedUser], {
      commitment: 'confirmed'
    });

    console.log("✅ Transfer transaction signature:", txSignature);

    // Fetch the transaction details
    const txDetails = await provider.connection.getTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!txDetails || !txDetails.meta || !txDetails.meta.logMessages) {
      throw new Error("Could not fetch transaction details");
    }

    console.log("\n📋 Checking for RedemptionEvent in logs...");

    let redemptionEventFound = false;
    let decodedEvent = null;
    // Method 1: Check for "Program data:" logs which contain event data
    for (const log of txDetails.meta.logMessages) {
      if (log.includes("Program data:")) {
        console.log("✅ Found Program data log (event emitted)");
        redemptionEventFound = true;

        // Decode the event
        decodedEvent = decodeRedemptionEvent(log, program);

        if (decodedEvent) {
          console.log("\n🎉 RedemptionEvent Details:");
          console.log("  From:", decodedEvent.data.from.toString());
          console.log("  Owner:", decodedEvent.data.owner.toString());
          console.log("  To:", decodedEvent.data.to.toString());
          console.log("  Amount:", decodedEvent.data.amount.toString());
          console.log("  Timestamp:", new Date(decodedEvent.data.timestamp * 1000).toISOString());

          // Verify the event data matches expected values
          assert.equal(
            decodedEvent.data.from.toString(),
            externalWhitelistedUserTokenAccount.toString(),
            "Event 'from' should match sender token account"
          );
          assert.equal(
            decodedEvent.data.to.toString(),
            internalWhitelistedUserTokenAccount.toString(),
            "Event 'to' should match recipient token account"
          );
          assert.equal(
            decodedEvent.data.amount.toString(),
            TRANSFER_AMOUNT.toString(),
            "Event amount should match transfer amount"
          );
        }

        break;
      }
    }

    // Method 2: Alternative parsing using EventParser (if available)
    try {
      const eventParser = new EventParser(program.programId, new BorshCoder(program.idl));
      const events = eventParser.parseLogs(txDetails.meta.logMessages);

      // Handle both array and generator return types
      const eventArray = Array.isArray(events) ? events : Array.from(events || []);

      console.log(`Number of events parsed: ${eventArray.length}`);

      for (let event of eventArray) {
        console.log("===Parsed Event===", JSON.stringify(event, null, 2));

        if (event.name === "RedemptionEvent" || event.name === "redemptionEvent") {
          redemptionEventFound = true;
          console.log("✅ Found and parsed RedemptionEvent:", event.data);

          // Verify event data
          if (event.data && event.data.amount) {
            assert.equal(
              event.data.amount.toString(),
              TRANSFER_AMOUNT.toString(),
              "Event amount should match transfer amount"
            );
          }
        }
      }
    } catch (parseError) {
      console.log("EventParser error (this is OK if Program data: log was found):", parseError.message);
    }

    // Assert that the redemption event was emitted
    assert.isTrue(redemptionEventFound, "RedemptionEvent should have been emitted (Program data: log found)");

    console.log("✅ RedemptionEvent confirmed!");

    // Verify balances after transfer (before burn)
    const balanceAfterTransfer = await getAccount(
      provider.connection,
      internalWhitelistedUserTokenAccount,
      null,
      TOKEN_2022_PROGRAM_ID
    );

    console.log("\n📊 Balance after transfer (before burn):", balanceAfterTransfer.amount.toString());

    // Verify tokens were transferred to the internal account
    const expectedRecipientBalanceAfterTransfer = new anchor.BN(initialRecipientBalance.amount.toString()).add(TRANSFER_AMOUNT);
    assert.equal(
      balanceAfterTransfer.amount.toString(),
      expectedRecipientBalanceAfterTransfer.toString(),
      "Tokens should have been transferred to internal account"
    );

    // Now burn the tokens from the internal account
    console.log(`\n🔥 Burning ${TRANSFER_AMOUNT.toString()} tokens from internal account...`);

    try {
      await burn(
        provider.connection,
        externalWhitelistedUser,
        internalWhitelistedUserTokenAccount,
        mint.publicKey,
        internalWhitelistedUser.publicKey,
        TRANSFER_AMOUNT,
        [internalWhitelistedUser],
        { commitment: 'confirmed' },
        TOKEN_2022_PROGRAM_ID
      );

      console.log("✅ Burn completed successfully");
    } catch (burnError) {
      console.error("❌ Burn failed:", burnError);
      throw burnError;
    }

    // Verify final state after burn
    const finalSenderBalance = await getAccount(provider.connection, externalWhitelistedUserTokenAccount, null, TOKEN_2022_PROGRAM_ID);
    const finalRecipientBalance = await getAccount(provider.connection, internalWhitelistedUserTokenAccount, null, TOKEN_2022_PROGRAM_ID);
    const finalMintSupply = await getMint(provider.connection, mint.publicKey, null, TOKEN_2022_PROGRAM_ID);

    console.log("\n📊 Final balances:");
    console.log("  Sender balance:", finalSenderBalance.amount.toString());
    console.log("  Recipient balance:", finalRecipientBalance.amount.toString());
    console.log("  Mint supply:", finalMintSupply.supply.toString());

    // Assert sender tokens were deducted by transfer
    const expectedSenderBalance = new anchor.BN(initialSenderBalance.amount.toString()).sub(TRANSFER_AMOUNT);
    assert.equal(
      finalSenderBalance.amount.toString(),
      expectedSenderBalance.toString(),
      "Sender balance should decrease by transfer amount"
    );

    // After burn, recipient should be back to initial balance (tokens burned)
    assert.equal(
      finalRecipientBalance.amount.toString(),
      initialRecipientBalance.amount.toString(),
      "Recipient balance should return to initial after burn"
    );

    // Verify total supply decreased by the burn amount
    const expectedSupply = new anchor.BN(initialMintSupply.supply.toString()).sub(TRANSFER_AMOUNT);
    assert.equal(
      finalMintSupply.supply.toString(),
      expectedSupply.toString(),
      "Supply should decrease by burn amount"
    );

    console.log("\n✅ Redemption flow completed successfully!");
    console.log(`   Transferred: ${TRANSFER_AMOUNT.toString()} tokens (external → internal)`);
    console.log(`   Burned: ${TRANSFER_AMOUNT.toString()} tokens`);
    console.log(`   New supply: ${finalMintSupply.supply.toString()}`);
  });
});

function decodeRedemptionEvent(programDataLog: string, program: Program) {
  try {
    // Extract the base64 data after "Program data: "
    const base64Data = programDataLog.replace("Program data: ", "").trim();

    console.log("\n📦 Raw base64 data:", base64Data);

    // Decode base64 to Buffer
    const eventData = Buffer.from(base64Data, "base64");

    console.log("📦 Decoded buffer length:", eventData.length);
    console.log("📦 Decoded buffer (hex):", eventData.toString("hex"));

    // The event data format in Anchor:
    // - First 8 bytes: Event discriminator (hash of "event:EventName")
    // - Remaining bytes: Borsh-encoded event data

    const discriminator = eventData.slice(0, 8);
    const eventPayload = eventData.slice(8);

    console.log("\n🔑 Event discriminator (hex):", discriminator.toString("hex"));
    console.log("📄 Event payload (hex):", eventPayload.toString("hex"));

    // Calculate the expected discriminator for RedemptionEvent
    const crypto = require("crypto");
    const expectedDiscriminator = crypto
      .createHash("sha256")
      .update("event:RedemptionEvent")
      .digest()
      .slice(0, 8);

    console.log("🔑 Expected RedemptionEvent discriminator:", expectedDiscriminator.toString("hex"));
    console.log("✅ Discriminators match:", discriminator.equals(expectedDiscriminator));

    // Use Anchor's BorshCoder to decode the event
    const coder = new BorshCoder(program.idl);

    // Try to decode using the event coder
    const decodedEvent = coder.events.decode(eventData.toString("hex"));

    if (decodedEvent) {
      console.log("\n✅ Successfully decoded RedemptionEvent:");
      console.log(JSON.stringify(decodedEvent, null, 2));
      return decodedEvent;
    }

    return null;
  } catch (error) {
    console.error("❌ Error decoding event:", error);
    return null;
  }
}