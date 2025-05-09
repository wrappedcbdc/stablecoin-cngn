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
  SYSVAR_INSTRUCTIONS_PUBKEY
} from '@solana/web3.js';
import { createSetAuthorityInstruction, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as nacl from 'tweetnacl';

import { calculatePDAs, stringToUint8Array, TokenPDAs } from '../utils/helpers';
import { initializeToken, setupUserAccounts, TOKEN_PARAMS } from "../utils/token_initializer";
import { transferAuthorityToPDA } from "./tranfer_authority_to_pda";


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

    // Add forwarder to the can_forward list
    await program.methods
      .addCanForward(forwarder.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        canForward: pdas.canForward,
      })
      .rpc();



    user1Balance = await getAccount(provider.connection, userTokenAccount);
    console.log("User1 initial token balance:", user1Balance.amount.toString());
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



    // Verify tokens were minted to user1
    user1Balance = await getAccount(provider.connection, userTokenAccount);
    console.log("User1 updated token balance:", user1Balance.amount.toString());
    assert.equal(user1Balance.amount.toString(), INITIAL_BALANCE.toString());

    // Calculate the transfer_auth PDA for the user's token account
    [transferAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from("transfer-auth"), userTokenAccount.toBuffer()],
      program.programId
    );

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

    let user2Balance = await getAccount(provider.connection, recipientTokenAccount);
    console.log("User2 initial token balance:", user2Balance.amount.toString());
    // Construct the Ed25519 verification instruction
    const message: Uint8Array = stringToUint8Array("CNGN Transfer");
    const signature = nacl.sign.detached(message, user.secretKey);

    console.log("=========Creating Ed25519 Instruction==========");
    const ed25519Instruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: user.publicKey.toBuffer(),
      message: message,
      signature: signature,
    });
    const valid = nacl.sign.detached.verify(
      message,
      signature,
      user.publicKey.toBuffer()
    );
    console.log("Signature is valid:", valid);
    // Fetch events

    program.addEventListener('forwardedEvent', (event, slot) => {
      console.log("Event received:", event.message.toString());
      expect(event.message.toString()).to.equal('CNGN Transfer');
    })

    program.addEventListener('tokensTransferredEvent', (event, slot) => {

    
      expect(event.from.toString()).to.equal(userTokenAccount.toString());
      expect(event.to.toString()).to.equal(recipientTokenAccount.toString());
      expect(event.amount.toString()).to.equal(INITIAL_BALANCE.toString());
    })


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
      .preInstructions([ed25519Instruction])
      .signers([forwarder])
      .rpc();

    console.log("Transaction signature:", txSignature);
    user2Balance = await getAccount(provider.connection, recipientTokenAccount);
    console.log("User2 final token balance:", user2Balance.amount.toString());



  });


  it('Fails to forward with invalid signature', async () => {


    // Get user1's token balance before the test
    const userBalanceBefore = await getAccount(provider.connection, userTokenAccount);

    // Create a message for transfer
    const message: Uint8Array = stringToUint8Array("CNGN Transfer");

    // Generate a signature with a different keypair (wrong signer)
    const invalidKeypair = Keypair.generate();
    const invalidSignature = nacl.sign.detached(message, invalidKeypair.secretKey);

    // Create the Ed25519 instruction
    const ed25519Instruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: user.publicKey.toBuffer(), // User's public key
      message: message,
      signature: invalidSignature, // Invalid signature
    });

    try {
      // Send transaction with invalid signature
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
        .preInstructions([ed25519Instruction])
        .signers([forwarder])
        .rpc();

      assert.fail("Should have failed with invalid signature");
    } catch (error) {
      // Expect an error
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
    // Create the message and signature
    const message: Uint8Array = stringToUint8Array("CNGN Transfer");
    const signature = nacl.sign.detached(message, user.secretKey);

    // Create the Ed25519 instruction
    const ed25519Instruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: user.publicKey.toBuffer(),
      message: message,
      signature: signature,
    });

    // Get user's current balance
    const userBalanceBefore = await getAccount(provider.connection, userTokenAccount);
    const userBalanceInt = Number(userBalanceBefore.amount.toString());

    // Try to transfer more than available
    const excessAmount = userBalanceInt + 1000;

    try {
      // Try to forward more tokens than available
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
        .preInstructions([ed25519Instruction])
        .signers([forwarder])
        .rpc();

      assert.fail("Should have failed with insufficient balance");
    } catch (error) {
      // Expect an error
      console.log("Transaction correctly failed with insufficient balance:", error.message);

      // Verify no tokens were transferred
      const userBalanceAfter = await getAccount(provider.connection, userTokenAccount);
      assert.equal(
        userBalanceAfter.amount.toString(),
        userBalanceBefore.amount.toString(),
        "Balance should not change with insufficient funds"
      );
    }
  });

  it('Successfully forwards partial amount of tokens', async () => {
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


    // Get balances before the test
    const userBalanceBefore = await getAccount(provider.connection, userTokenAccount);
    const recipientBalanceBefore = await getAccount(provider.connection, recipientTokenAccount);

    // Create the message and signature
    const message: Uint8Array = stringToUint8Array("CNGN Transfer");
    const signature = nacl.sign.detached(message, user.secretKey);

    // Create the Ed25519 instruction
    const ed25519Instruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: user.publicKey.toBuffer(),
      message: message,
      signature: signature,
    });

    // Forward just part of the balance
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
      .preInstructions([ed25519Instruction])
      .signers([forwarder])
      .rpc();

    console.log("Partial transfer transaction signature:", txSignature);

    program.addEventListener('tokensTransferredEvent', (event, slot) => {

      expect(event.from.toString()).to.equal(userTokenAccount.toString());
      expect(event.to.toString()).to.equal(recipientTokenAccount.toString());
      expect(event.amount.toString()).to.equal(INITIAL_BALANCE.toString());
    })

    // Verify the correct amount was transferred
    const userBalanceAfter = await getAccount(provider.connection, userTokenAccount);
    const recipientBalanceAfter = await getAccount(provider.connection, recipientTokenAccount);

    const userBalanceDiff = Number(userBalanceBefore.amount.toString()) - Number(userBalanceAfter.amount.toString());
    const recipientBalanceDiff = Number(recipientBalanceAfter.amount.toString()) - Number(recipientBalanceBefore.amount.toString());

    assert.equal(userBalanceDiff, PARTIAL_AMOUNT, "User should have the partial amount deducted");
    assert.equal(recipientBalanceDiff, PARTIAL_AMOUNT, "Recipient should have received the partial amount");
  });

});


function bytesToHexString(bytes) {
  return Buffer.from(bytes).toString('hex');
}