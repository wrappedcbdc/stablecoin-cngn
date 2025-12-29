import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Cngn } from "../target/types/cngn";
import { assert, expect } from 'chai';
import { PublicKey, Keypair, Transaction, Ed25519Program, SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js';
import {
  approve,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
  AuthorityType,
  createTransferCheckedWithTransferHookInstruction
} from '@solana/spl-token';
import * as nacl from 'tweetnacl';
import { calculatePDAs, stringToUint8Array, TokenPDAs } from '../utils/helpers';
import { initializeToken, setupUserAccounts, TOKEN_PARAMS } from "../utils/token_initializer";
import { transferAuthorityToPDA } from "./transfer-authority-to-pda";

describe('Transaction Forwarding Tests', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cngn as Program<Cngn>;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const mint = Keypair.generate();
  const minter = Keypair.generate();
  const user = Keypair.generate();
  const recipient = Keypair.generate();
  const forwarder = Keypair.generate();
  const unauthorizedForwarder = Keypair.generate();

  let pdas: TokenPDAs;
  let userTokenAccount: PublicKey;
  let recipientTokenAccount: PublicKey;
  let transferAuth: PublicKey;

  const INITIAL_BALANCE = TOKEN_PARAMS.mintAmount;
  const TRANSFER_AMOUNT = TOKEN_PARAMS.transferAmount;
  const PARTIAL_AMOUNT = TOKEN_PARAMS.partialAmount;

  before(async () => {
    // Calculate PDAs
    pdas = calculatePDAs(mint.publicKey, program.programId);

    // Initialize token
    await initializeToken(program, provider, mint, pdas);

     let afterMintInfo=await transferAuthorityToPDA(pdas, mint, payer, provider)
      // Assertions to verify transfer
      assert(afterMintInfo.mintAuthority?.equals(pdas.mintAuthority), "Mint authority should be the PDA");
      assert(afterMintInfo.freezeAuthority?.equals(payer.publicKey), "Freeze authority should be the PDA");
    // Setup user accounts
    const userAccounts = await setupUserAccounts(
      provider,
      [user, recipient],
      mint.publicKey
    );

    [userTokenAccount, recipientTokenAccount] = userAccounts;

    // Add minter
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

    // Add forwarder
    await program.methods
      .addCanForward(forwarder.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        canForward: pdas.canForward,
      })
      .rpc();

    // Mint tokens to user
    await program.methods
      .mint(INITIAL_BALANCE)
      .accounts({
        authority: minter.publicKey,
        tokenConfig: pdas.tokenConfig,
        mintAuthority: pdas.mintAuthority,
        mint: mint.publicKey,
        tokenAccount: userTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts
      })
      .signers([minter])
      .rpc();

    // Verify minted balance
    const userBalance = await getAccount(
      provider.connection,
      userTokenAccount,
      null,
      TOKEN_2022_PROGRAM_ID
    );
    console.log("User initial token balance:", userBalance.amount.toString());
    assert.equal(userBalance.amount.toString(), INITIAL_BALANCE.toString());


    //Use approve() to set delegate 
    await approve(
      provider.connection,
      payer,
      userTokenAccount,
      forwarder.publicKey,
      user,
      BigInt(INITIAL_BALANCE.toString()),
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    // Verify delegate was set
    const updatedTokenAccount = await getAccount(
      provider.connection,
      userTokenAccount,
      null,
      TOKEN_2022_PROGRAM_ID
    );

    console.log("Delegate set to:", updatedTokenAccount.delegate?.toString());
    console.log("Delegated amount:", updatedTokenAccount.delegatedAmount.toString());

    assert(
      updatedTokenAccount.delegate?.equals(forwarder.publicKey),
      "Token account delegate not set to PDA"
    );
  });

  it('Forwards tokens from user to recipient', async () => {
    const recipientBalanceBefore = await getAccount(
      provider.connection,
      recipientTokenAccount,
      null,
      TOKEN_2022_PROGRAM_ID
    );

    console.log("Recipient balance before:", recipientBalanceBefore.amount.toString());

    // // Create message and signature
    // const message: Uint8Array = stringToUint8Array("CNGN Transfer");
    // const signature = nacl.sign.detached(message, user.secretKey);

    // // Create Ed25519 instruction
    // const ed25519Instruction = Ed25519Program.createInstructionWithPublicKey({
    //     publicKey: user.publicKey.toBuffer(),
    //     message: message,
    //     signature: signature,
    // });

    // // Verify signature
    // const valid = nacl.sign.detached.verify(
    //     message,
    //     signature,
    //     user.publicKey.toBuffer()
    // );
    // console.log("Signature is valid:", valid);
    // assert(valid, "Signature should be valid");

    // Execute forwarded transfer

    let transferTx = await createTransferCheckedWithTransferHookInstruction(
      provider.connection,
      userTokenAccount, // source
      mint.publicKey, // mint
      recipientTokenAccount, // destination
      forwarder.publicKey, // Source Token Account owner
      INITIAL_BALANCE,  // Amount
      6, // decimals
      undefined, // Additional signers
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    const tx = new anchor.web3.Transaction().add(transferTx);

    await provider.sendAndConfirm(tx, [forwarder]);

    // Verify balances after transfer
    const recipientBalanceAfter = await getAccount(
      provider.connection,
      recipientTokenAccount,
      null,
      TOKEN_2022_PROGRAM_ID
    );

    console.log("Recipient balance after:", recipientBalanceAfter.amount.toString());

    const expectedBalance = Number(recipientBalanceBefore.amount) + Number(INITIAL_BALANCE);
    assert.equal(
      recipientBalanceAfter.amount.toString(),
      expectedBalance.toString(),
      "Recipient should have received tokens"
    );
  });

  it('Fails to forward with unauthorized forwarder', async () => {
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
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts
      })
      .signers([minter])
      .rpc();

    // Re-approve because previous transfer might have consumed the allowance or we want a clean state
    await approve(
      provider.connection,
      payer,
      userTokenAccount,
      unauthorizedForwarder.publicKey,
      user,
      BigInt(INITIAL_BALANCE.toString()),
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    try {
      let transferInstruction = await createTransferCheckedWithTransferHookInstruction(
        provider.connection,
        userTokenAccount,
        mint.publicKey,
        recipientTokenAccount,
        unauthorizedForwarder.publicKey,
        INITIAL_BALANCE,
        6,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID,
      );

      const tx = new anchor.web3.Transaction().add(transferInstruction);
      await provider.sendAndConfirm(tx, [unauthorizedForwarder]);

      // If we reach here, the test failed to throw
      assert.fail("Should have failed with unauthorized forwarder");
    } catch (error) {

      expect(error.message).includes("UnauthorizedForwarder");
    }
  });

  it('Successfully forwards partial amount of tokens', async () => {
    // Ensure we have funds (minting again just to be safe, or rely on funds from previous test)
    // Since previous test failed (as expected), user still has the funds we minted there.

    // Approve the forwarder
    await approve(
      provider.connection,
      payer,
      userTokenAccount,
      forwarder.publicKey,
      user,
      BigInt(INITIAL_BALANCE.toString()), // Large allowance
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    const userBalanceBefore = await getAccount(
      provider.connection,
      userTokenAccount,
      null,
      TOKEN_2022_PROGRAM_ID
    );
    const recipientBalanceBefore = await getAccount(
      provider.connection,
      recipientTokenAccount,
      null,
      TOKEN_2022_PROGRAM_ID
    );

    // Create Instruction
    let transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      provider.connection,
      userTokenAccount,
      mint.publicKey,
      recipientTokenAccount,
      forwarder.publicKey,
      PARTIAL_AMOUNT, // Use the variable you defined (250)
      6,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );

    // 2. EXECUTE TRANSACTION (This was missing)
    const tx = new anchor.web3.Transaction().add(transferInstruction);
    await provider.sendAndConfirm(tx, [forwarder]);

    const userBalanceAfter = await getAccount(
      provider.connection,
      userTokenAccount,
      null,
      TOKEN_2022_PROGRAM_ID
    );
    const recipientBalanceAfter = await getAccount(
      provider.connection,
      recipientTokenAccount,
      null,
      TOKEN_2022_PROGRAM_ID
    );

    // Use BigInt for precise calculation, or Number if amounts are small enough
    const userBalanceDiff = Number(userBalanceBefore.amount) - Number(userBalanceAfter.amount);
    const recipientBalanceDiff = Number(recipientBalanceAfter.amount) - Number(recipientBalanceBefore.amount);

    assert.equal(userBalanceDiff, PARTIAL_AMOUNT, "Correct amount deducted");
    assert.equal(recipientBalanceDiff, PARTIAL_AMOUNT, "Correct amount received");
  });

  it('Removed Forwarder cannot forward tokens from user to recipient', async () => {
    const recipientBalanceBefore = await getAccount(
      provider.connection,
      recipientTokenAccount,
      null,
      TOKEN_2022_PROGRAM_ID
    );

    console.log("Recipient balance before:", recipientBalanceBefore.amount.toString());
    // Add forwarder
    await program.methods
      .removeCanForward(forwarder.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        canForward: pdas.canForward,
      })
      .rpc();
    // Approve the forwarder
    await approve(
      provider.connection,
      payer,
      userTokenAccount,
      forwarder.publicKey,
      user,
      BigInt(INITIAL_BALANCE.toString()), // Large allowance
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    // Execute forwarded transfer
    try {
      let transferTx = await createTransferCheckedWithTransferHookInstruction(
        provider.connection,
        userTokenAccount, // source
        mint.publicKey, // mint
        recipientTokenAccount, // destination
        forwarder.publicKey, // Source Token Account owner
        200,  // Amount
        6, // decimals
        undefined, // Additional signers
        undefined, // Confirmation options
        TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
      );

      const tx = new anchor.web3.Transaction().add(transferTx);

      await provider.sendAndConfirm(tx, [forwarder]);
      assert.fail("Transfer should have failed with invalid owner");
    } catch (error) {

      assert.include(error.message.toString(), "UnauthorizedForwarder");

    }


    // Verify balances after transfer
    const recipientBalanceAfter = await getAccount(
      provider.connection,
      recipientTokenAccount,
      null,
      TOKEN_2022_PROGRAM_ID
    );

    console.log("Recipient balance after:", recipientBalanceAfter.amount.toString());
    assert.equal(
      recipientBalanceAfter.amount.toString(),
      recipientBalanceBefore.amount.toString(),
      "Recipient should have received tokens"
    );


  });

});