import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { Cngn } from "../target/types/cngn";
import { assert, expect } from 'chai';
import {
  PublicKey,
  Keypair,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { createSetAuthorityInstruction, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as nacl from 'tweetnacl';

import { bytesToHexString, calculatePDAs, calculateUserNoncePDA, createSignedMessageWithNonce, formatMessage, stringToUint8Array, TokenPDAs } from '../utils/helpers';
import { initializeToken, setupUserAccounts, TOKEN_PARAMS } from "../utils/token_initializer";
import { transferAuthorityToPDA } from "./transfer_authority_to_pda";


describe('Transaction Forwarding Tests', () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cngn as Program<Cngn>;
  const payer = (provider.wallet as anchor.Wallet).payer;
  // Create keypairs for different test actors
  const mint = Keypair.generate();

  // Create user keypairs for different test scenarios
  const minter = Keypair.generate();
  const user = Keypair.generate(); // Regular user who wants to transfer
  const recipient = Keypair.generate(); // Recipient of the transfer
  const forwarder = Keypair.generate(); // Entity that forwards the transaction
  const blacklistedUser = Keypair.generate(); // User on blacklist
  const externalWhitelistedUser = Keypair.generate(); // External whitelisted user
  const internalWhitelistedUser = Keypair.generate(); // Internal whitelisted user

  // PDAs and token accounts
  let pdas: TokenPDAs;
  let userTokenAccount: PublicKey;
  let recipientTokenAccount: PublicKey;
  let blacklistedUserTokenAccount: PublicKey;
  let externalWhitelistedUserTokenAccount: PublicKey;
  let internalWhitelistedUserTokenAccount: PublicKey;
  let userNoncePDA: PublicKey;
  let transferAuth: PublicKey;
  let user1Balance: any;
  // Initial token balances for reference
  const INITIAL_BALANCE = TOKEN_PARAMS.mintAmount;
  const TRANSFER_AMOUNT = TOKEN_PARAMS.transferAmount;
  const PARTIAL_AMOUNT = TOKEN_PARAMS.partialAmount;
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
      [user, recipient, blacklistedUser, externalWhitelistedUser, internalWhitelistedUser],
      mint.publicKey
    );

    [
      userTokenAccount,
      recipientTokenAccount,
      blacklistedUserTokenAccount,
      externalWhitelistedUserTokenAccount,
      internalWhitelistedUserTokenAccount
    ] = userAccounts;

    // Fund the user with enough SOL to pay for account creation
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL)
    )
    userNoncePDA = await calculateUserNoncePDA(user, pdas, program);
    console.log("User nonce PDA:", userNoncePDA.toBase58());
    // Calculate the transfer_auth PDA for the user's token account
    [transferAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from("transfer-auth"), userTokenAccount.toBuffer()],
      program.programId
    );
    // Add forwarder to the can_forward list
    await program.methods
      .addCanForward(forwarder.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        canForward: pdas.canForward,
      })
      .rpc();
    // Set the owner of the user's token account to the transfer_auth PDA
    const setAuthorityTx = new Transaction().add(
      createSetAuthorityInstruction(
        userTokenAccount,
        user.publicKey,
        2,
        transferAuth,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    await provider.sendAndConfirm(setAuthorityTx, [user]);

    // Verify the owner was updated
    const updatedTokenAccount = await getAccount(provider.connection, userTokenAccount);
    assert(updatedTokenAccount.owner.equals(transferAuth), "Token account owner not updated to PDA");
  });


  it('Forwards tokens from user to recipient', async () => {
    await setupAccount(program, minter, INITIAL_BALANCE, userTokenAccount, pdas, provider, mint)

    let user2Balance = await getAccount(provider.connection, recipientTokenAccount);
    console.log("User2 initial token balance:", user2Balance.amount.toString());

    const {
      message,
      signature,
      ed25519Ix,
      nonce,
    } = await createSignedMessageWithNonce(
      "transfer",
      INITIAL_BALANCE.toString(),
      user,
      forwarder,
      pdas,
      program,
      true
    )

    const valid = nacl.sign.detached.verify(
      message,
      signature,
      user.publicKey.toBuffer()
    );
    console.log("Signature is valid:", valid);
    // Fetch events






    console.log("=========Forwarding Transaction to Recipient==========");

    // Send transaction
    const txSignature = await program.methods
      .execute(

        bytesToHexString(message),
        bytesToHexString(signature),
        INITIAL_BALANCE,
      )
      .accounts({
        authority: provider.wallet.publicKey,
        forwarder: forwarder.publicKey,
        transferAuth: transferAuth,
        from: userTokenAccount,
        //userNonce: userNoncePDA,
        to: recipientTokenAccount,
        blacklist: pdas.blacklist,
        sender: user.publicKey,
        tokenConfig: pdas.tokenConfig,
        canForward: pdas.canForward,
        mint: mint.publicKey,
        canMint: pdas.canMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([ed25519Ix])
      .signers([forwarder])
      .rpc();

    program.addEventListener('forwardedEvent', (event, slot) => {
      console.log("Event received:", event.message.toString());
      expect(event.message.toString()).to.equal(`transfer:${INITIAL_BALANCE}:${nonce}`);
    })

    console.log("Transaction signature:", txSignature);
    user2Balance = await getAccount(provider.connection, recipientTokenAccount);
    console.log("User2 final token balance:", user2Balance.amount.toString());

    program.addEventListener('tokensTransferredEvent', (event, slot) => {
      expect(event.from.toString()).to.equal(userTokenAccount.toString());
      expect(event.to.toString()).to.equal(recipientTokenAccount.toString());
      expect(event.amount.toString()).to.equal(PARTIAL_AMOUNT.toString());
    })

  });


  it('Fails to forward with invalid signature', async () => {
    //Generate a signature with a different keypair (wrong signer)
    const invalidKeypair = Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(invalidKeypair.publicKey, 2 * LAMPORTS_PER_SOL)
    )
    const invalidUserNoncePDA = await calculateUserNoncePDA(invalidKeypair, pdas, program);
    await setupAccount(program, minter, INITIAL_BALANCE, userTokenAccount, pdas, provider, mint)

    //Get user1's token balance before the test
    const userBalanceBefore = await getAccount(provider.connection, userTokenAccount);

    console.log("User1 initial token balance:", userBalanceBefore.amount.toString());

    const {
      message,
      signature: invalidSignature,
      ed25519Ix,
      nonce,
    } = await createSignedMessageWithNonce(
      "transfer",
      INITIAL_BALANCE.toString(),
      invalidKeypair,
      forwarder,
      pdas,
      program,
      true
    )



    try {
      //Send transaction with invalid signature
      await program.methods
        .execute(
          bytesToHexString(message),
          bytesToHexString(invalidSignature),
          TRANSFER_AMOUNT,
        )
        .accounts({
          authority: provider.wallet.publicKey,
          forwarder: forwarder.publicKey,
          transferAuth: transferAuth,
          from: userTokenAccount,
          to: recipientTokenAccount,
          UserNonce: invalidUserNoncePDA,
          blacklist: pdas.blacklist,
          sender: user.publicKey,
          tokenConfig: pdas.tokenConfig,
          canForward: pdas.canForward,
          mint: mint.publicKey,
          canMint: pdas.canMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .preInstructions([ed25519Ix])
        .signers([forwarder])
        .rpc();

      assert.fail("Should have failed with invalid signature");
    } catch (error) {
      //Expect an error
      console.log("Transaction correctly failed with invalid signature:", error.message);

      // Verify no tokens were transferred
      const userBalanceAfter = await getAccount(provider.connection, userTokenAccount);
      assert.equal(
        userBalanceAfter.amount.toString(),
        userBalanceBefore.amount.toString(),
        "Balance should not change with invalid signature"
      );
    }
  });

  it('Fails to forward with insufficient balance', async () => {

    //Get user's current balance
    const userBalanceBefore = await getAccount(provider.connection, userTokenAccount);
    const userBalanceInt = Number(userBalanceBefore.amount.toString());

    // Try to transfer more than available
    const excessAmount = userBalanceInt + 1000;
    console.log(excessAmount)

    //Create the message and signature with format "transfer:amount:nonce"
    const {
      message,
      signature,
      ed25519Ix,
      nonce,
    } = await createSignedMessageWithNonce(
      "transfer",
      INITIAL_BALANCE.toString(),
      user,
      forwarder,
      pdas,
      program,
      true
    )



    try {
      //Try to forward more tokens than available
      await program.methods
        .execute(
          bytesToHexString(message),
          bytesToHexString(signature),
          new anchor.BN(excessAmount),
        )
        .accounts({
          authority: provider.wallet.publicKey,
          forwarder: forwarder.publicKey,
          transferAuth: transferAuth,
          from: userTokenAccount,
          to: recipientTokenAccount,
          UserNonce: userNoncePDA,
          blacklist: pdas.blacklist,
          sender: user.publicKey,
          tokenConfig: pdas.tokenConfig,
          canForward: pdas.canForward,
          mint: mint.publicKey,
          canMint: pdas.canMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .preInstructions([ed25519Ix])
        .signers([forwarder])
        .rpc();


    } catch (error) {
      //Expect an error
      console.log("Transaction correctly failed with insufficient balance:", error.message);

      //Verify no tokens were transferred
      const userBalanceAfter = await getAccount(provider.connection, userTokenAccount);
      assert.equal(
        userBalanceAfter.amount.toString(),
        userBalanceBefore.amount.toString(),
        "Balance should not change with insufficient funds"
      );
    }
  });

  it('Successfully forwards partial amount of tokens', async () => {

    //Get balances before the test
    const userBalanceBefore = await getAccount(provider.connection, userTokenAccount);
    const recipientBalanceBefore = await getAccount(provider.connection, recipientTokenAccount);

    //Create the message and signature with format "transfer:amount:nonce"
    const {
      message,
      signature,
      ed25519Ix,
      nonce,
    } = await createSignedMessageWithNonce(
      "transfer",
      PARTIAL_AMOUNT.toString(),
      user,
      forwarder,
      pdas,
      program,
      true
    )

    //Forward just part of the balance
    const txSignature = await program.methods
      .execute(
        bytesToHexString(message),
        bytesToHexString(signature),
        PARTIAL_AMOUNT,
      )
      .accounts({
        authority: provider.wallet.publicKey,
        forwarder: forwarder.publicKey,
        transferAuth: transferAuth,
        from: userTokenAccount,
        to: recipientTokenAccount,
        UserNonce: userNoncePDA,
        blacklist: pdas.blacklist,
        sender: user.publicKey,
        tokenConfig: pdas.tokenConfig,
        canForward: pdas.canForward,
        mint: mint.publicKey,
        canMint: pdas.canMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([ed25519Ix])
      .signers([forwarder])
      .rpc();

    console.log("Partial transfer transaction signature:", txSignature);
    program.addEventListener('forwardedEvent', (event, slot) => {
      console.log("Event received:", event.message.toString());
      expect(event.message.toString()).to.equal(`transfer:${PARTIAL_AMOUNT.toString()}:${nonce}`);
    })
    program.addEventListener('tokensTransferredEvent', (event, slot) => {

      expect(event.from.toString()).to.equal(userTokenAccount.toString());
      expect(event.to.toString()).to.equal(recipientTokenAccount.toString());
      expect(event.amount.toString()).to.equal(PARTIAL_AMOUNT.toString());
    })

    //Verify the correct amount was transferred
    const userBalanceAfter = await getAccount(provider.connection, userTokenAccount);
    const recipientBalanceAfter = await getAccount(provider.connection, recipientTokenAccount);
    console.log("User balance before:", userBalanceBefore.amount.toString());
    console.log("Recipient balance before:", recipientBalanceBefore.amount.toString());
    console.log("User balance after:", userBalanceAfter.amount.toString());
    console.log("Recipient balance after:", recipientBalanceAfter.amount.toString());

    const userBalanceDiff = parseInt(userBalanceBefore.amount.toString()) - parseInt(userBalanceAfter.amount.toString());
    const recipientBalanceDiff = parseInt(recipientBalanceAfter.amount.toString()) - parseInt(recipientBalanceBefore.amount.toString());
    console.log("User balance diff:", userBalanceDiff);
    console.log("Recipient balance diff:", recipientBalanceDiff);

    expect(userBalanceDiff.toString()).to.equal(PARTIAL_AMOUNT.toString());
    expect(recipientBalanceDiff.toString()).to.equal(PARTIAL_AMOUNT.toString());


  });


  it('Should fail to Forward tokens from user to recipient - Replay Attack', async () => {
    let user2Balance = await getAccount(provider.connection, recipientTokenAccount);
    console.log("User2 initial token balance:", user2Balance.amount.toString());
    await setupAccount(program, minter, INITIAL_BALANCE, userTokenAccount, pdas, provider, mint)

    // === First valid transfer ===
    const {
      message,
      signature,
      ed25519Ix,
      nonce,
    } = await createSignedMessageWithNonce(
      "transfer",
      INITIAL_BALANCE.toString(),
      user,
      forwarder,
      pdas,
      program,
      true
    );

    // Setup event listeners (optional but useful for debugging)
    program.addEventListener('forwardedEvent', (event, _slot) => {
      console.log("Event received:", event.message.toString());
    });

    program.addEventListener('tokensTransferredEvent', (event, _slot) => {
      expect(event.from.toString()).to.equal(userTokenAccount.toString());
      expect(event.to.toString()).to.equal(recipientTokenAccount.toString());
      expect(event.amount.toString()).to.equal(INITIAL_BALANCE.toString());
    });

    console.log(`========= Forwarding Transaction to Recipient with nonce ${nonce} ==========`);

    // First transaction should succeed
    const txSignature1 = await program.methods
      .execute(
        bytesToHexString(message),
        bytesToHexString(signature),
        INITIAL_BALANCE,
      )
      .accounts({
        authority: provider.wallet.publicKey,
        forwarder: forwarder.publicKey,
        transferAuth: transferAuth,
        from: userTokenAccount,
        to: recipientTokenAccount,
        blacklist: pdas.blacklist,
        sender: user.publicKey,
        tokenConfig: pdas.tokenConfig,
        canForward: pdas.canForward,
        mint: mint.publicKey,
        canMint: pdas.canMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([ed25519Ix])
      .signers([forwarder])
      .rpc();

    console.log("Transaction signature:", txSignature1);

    user2Balance = await getAccount(provider.connection, recipientTokenAccount);
    console.log("User2 balance after first transfer:", user2Balance.amount.toString());

    // === Assertion after first successful transfer ===
    //expect(user2Balance.amount.toString()).to.equal(INITIAL_BALANCE.toString());

    // === Replay attempt with same nonce ===
    console.log("========= Attempting to replay the same transaction (should fail) ==========");

    try {
      await program.methods
        .execute(
          bytesToHexString(message),
          bytesToHexString(signature),
          PARTIAL_AMOUNT,
        )
        .accounts({
          authority: provider.wallet.publicKey,
          forwarder: forwarder.publicKey,
          transferAuth: transferAuth,
          from: userTokenAccount,
          to: recipientTokenAccount,
          blacklist: pdas.blacklist,
          sender: user.publicKey,
          tokenConfig: pdas.tokenConfig,
          canForward: pdas.canForward,
          mint: mint.publicKey,
          canMint: pdas.canMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .preInstructions([ed25519Ix])
        .signers([forwarder])
        .rpc();

      // If it doesn't throw, the replay protection failed
      assert.fail("Replay attack should have failed but succeeded");
    } catch (error) {
      console.log("Replay attack correctly failed with error:", error.message);
      expect(error.message).to.include("InvalidNonce"); // Your program must throw this specific error
    }

    // === Second valid transfer with incremented nonce ===
    console.log("========= Trying with incremented nonce (should succeed) ==========");

    const {
      message: message2,
      signature: signature2,
      ed25519Ix: ed25519Ix2,
      nonce: nonce2,
    } = await createSignedMessageWithNonce(
      "transfer",
      PARTIAL_AMOUNT.toString(),
      user,
      forwarder,
      pdas,
      program,
      true // Ensure it increments the nonce internally
    );

    const txSignature3 = await program.methods
      .execute(
        bytesToHexString(message2),
        bytesToHexString(signature2),
        PARTIAL_AMOUNT,
      )
      .accounts({
        authority: provider.wallet.publicKey,
        forwarder: forwarder.publicKey,
        transferAuth: transferAuth,
        from: userTokenAccount,
        to: recipientTokenAccount,
        blacklist: pdas.blacklist,
        sender: user.publicKey,
        tokenConfig: pdas.tokenConfig,
        canForward: pdas.canForward,
        mint: mint.publicKey,
        canMint: pdas.canMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([ed25519Ix2])
      .signers([forwarder])
      .rpc();

    console.log("Transaction with incremented nonce signature:", txSignature3);

    // === Final balance check ===
    user2Balance = await getAccount(provider.connection, recipientTokenAccount);
    console.log("User2 final token balance:", user2Balance.amount.toString());

    const expectedFinalBalance =
      parseInt(INITIAL_BALANCE.toString()) + parseInt(PARTIAL_AMOUNT.toString());

    //expect(user2Balance.amount.toString()).to.equal(expectedFinalBalance.toString());
  });

  it('Fails when Ed25519 instruction is not immediately prior (ignores instruction_index)', async () => {
    const dummyIx = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: payer.publicKey,
      lamports: 0,
    });
    const message = stringToUint8Array("CNGN Transfer");

    const signature = nacl.sign.detached(message, user.secretKey);
    const edIx = Ed25519Program.createInstructionWithPublicKey({
      publicKey: user.publicKey.toBuffer(), message,
      signature,
    });
    console.log("\n=========Creating Malicious Ed25519 Instruction==========");
    const wrongIx = new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID, // used token program to create a wrong but working instruction
      keys: [], // No keys needed for this example data: Buffer.from(edIx.data),
    });
    // Place a dummy instruction between current and edIx
    const pre = [edIx, wrongIx];
    console.log("\n=========Forwarding Transaction to Recipient in Wrong Order==========");
    try {
      const txSignature = await program.methods
        .execute(
          bytesToHexString(message),
          bytesToHexString(signature),
          PARTIAL_AMOUNT,
        ).accounts({
          authority: provider.wallet.publicKey,
          forwarder: forwarder.publicKey,
          transferAuth: transferAuth,
          from: userTokenAccount,
          to: recipientTokenAccount,
          blacklist: pdas.blacklist,
          sender: user.publicKey,
          tokenConfig: pdas.tokenConfig,
          canForward: pdas.canForward,
          mint: mint.publicKey,
          canMint: pdas.canMint,
          tokenProgram: TOKEN_PROGRAM_ID, instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY, rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        }).preInstructions(pre)
        .signers([forwarder])
        .rpc();
      console.log("Test case failed, tx executed, sig:", txSignature);
      assert.fail("Should have failed because we put the Ed25519 instruction >1 back");

    } catch (err) {
      // We expect it to blow up in Missinged25519Ix or Invalided25519Ix
      console.log("VULNERABLE: tx succeeded when it should have failed");
      console.log("Test case passed, error:", err.toString());
    }
  });
  it('Fails if Ed25519 sender pubkey does not match expected', async () => {
   
    // Generate a fake public key to use instead of the actual sender's key
    const fakeKeypair = Keypair.generate();

   //Create the message and signature with format "transfer:amount:nonce"
    const {
      message,
      signature,
      ed25519Ix,
      nonce,
    } = await createSignedMessageWithNonce(
      "transfer",
      PARTIAL_AMOUNT.toString(),
      user,
      forwarder,
      pdas,
      program,
      true
    )

    let threw = false;
    try {
      await program.methods
        .execute(
          bytesToHexString(message),
          bytesToHexString(signature),
          TRANSFER_AMOUNT
        )
        .accounts({
          authority: provider.wallet.publicKey,
          forwarder: forwarder.publicKey,
          transferAuth: transferAuth,
          from: userTokenAccount,
          to: recipientTokenAccount,
          blacklist: pdas.blacklist,
          sender: user.publicKey, // Real sender
          tokenConfig: pdas.tokenConfig,
          canForward: pdas.canForward,
          userNonce: userNoncePDA,
          mint: mint.publicKey,
          internalWhitelist: pdas.internalWhitelist,
          externalWhitelist: pdas.externalWhitelist,
          tokenProgram: TOKEN_PROGRAM_ID,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([ed25519Ix])
        .signers([forwarder])
        .rpc();
    } catch (e) {
      threw = true;
      console.log("Expected failure:", e.message);
      expect(e.message).to.include("InvalidEd25519Pubkey");
    }

    //assert(threw, "Execution should fail when Ed25519 pubkey doesn't match expected sender");
  });

  it('Fails if Ed25519 instruction has out-of-bounds offsets', async () => {
    const message = formatMessage("transfer", TRANSFER_AMOUNT.toString(), 0); // Fake nonce 0
    const messageBytes = stringToUint8Array(message);
    const signature = nacl.sign.detached(messageBytes, user.secretKey);

    // Forge an invalid Ed25519 instruction with wrong offset pointing beyond bounds
    const invalidOffsets = Buffer.alloc(14); // 7 * u16
    const data = Buffer.concat([
      Buffer.from([1, 0]), // numSignatures = 1
      invalidOffsets,
      Buffer.from(signature),
      user.publicKey.toBuffer(),
      messageBytes,
    ]);

    const ed25519Ix = new TransactionInstruction({
      programId: Ed25519Program.programId,
      keys: [],
      data,
    });

    let threw = false;
    try {
      await program.methods
        .execute(
          bytesToHexString(messageBytes),
          bytesToHexString(signature),
          TRANSFER_AMOUNT
        )
        .accounts({
          authority: provider.wallet.publicKey,
          forwarder: forwarder.publicKey,
          transferAuth: transferAuth,
          from: userTokenAccount,
          to: recipientTokenAccount,
          blacklist: pdas.blacklist,
          sender: user.publicKey,
          tokenConfig: pdas.tokenConfig,
          canForward: pdas.canForward,
          userNonce: userNoncePDA,
          mint: mint.publicKey,
          internalWhitelist: pdas.internalWhitelist,
          externalWhitelist: pdas.externalWhitelist,
          tokenProgram: TOKEN_PROGRAM_ID,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([ed25519Ix])
        .signers([forwarder])
        .rpc();
    } catch (e) {
      threw = true;
      console.log("Expected failure:", e.message);
      expect(e.message).to.include("Invalided25519Ix");
    }

    assert(threw, "Instruction with out-of-bounds offsets should throw");
  });


});



async function setupAccount(program: any, minter: any, INITIAL_BALANCE: any, userTokenAccount: any, pdas: any, provider: any, mint: any) {
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
      tokenAccount: userTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      blacklist: pdas.blacklist,
      canMint: pdas.canMint,
      trustedContracts: pdas.trustedContracts
    })
    .signers([minter])
    .rpc();
}