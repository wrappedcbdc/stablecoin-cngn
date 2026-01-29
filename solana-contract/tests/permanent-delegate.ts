import type { Program } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import * as crypto from 'crypto';
import {
  createBurnCheckedInstruction,
  createFreezeAccountInstruction,
  createMultisig,
  createThawAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import type { Cngn } from '../target/types/cngn';
import { Keypair, PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY, Transaction } from '@solana/web3.js';
import {

  calculatePDAs,
  createMintAccountWithExtensions,
  TEST_TOKEN_PARAMS,

} from '../utils/helpers';
import { initializeMultisig, initializeToken, setupUserAccounts, TOKEN_PARAMS, } from '../utils/token_initializer';
import { assert } from 'chai';
import { createEd25519Ix } from '../utils/multisig_helpers';
import nacl from 'tweetnacl';

describe('permanent-delegate', () => {
  const connection = new anchor.web3.Connection('http://127.0.0.1:8899', 'confirmed');
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);
  const payer = (provider.wallet as anchor.Wallet).payer;
  const program = anchor.workspace.Cngn as Program<Cngn>;

  const mint = Keypair.generate();
  const splMultisig = Keypair.generate();
  const testContract = Keypair.generate();
  const regularUser1 = Keypair.generate();
  const regularUser2 = Keypair.generate();
  const blacklistedUser = Keypair.generate();
  const mintAuthorityUser = Keypair.generate();

  //Token Accounts
  let regularUser1TokenAccount: PublicKey;
  let regularUser2TokenAccount: PublicKey;
  let mintAuthorityUserTokenAccount: PublicKey;

  // Multisig owners
  const owner1 = Keypair.generate();
  const owner2 = Keypair.generate();
  const owner3 = Keypair.generate();
  const threshold = 2;

  let pdas: any;
  let multisigPda: PublicKey;



  // Helper to build message hash
  function buildMessageHash(prefix: string, ...components: (PublicKey | Buffer | number)[]): Buffer {
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(prefix));
    hash.update(program.programId.toBuffer());
    for (const comp of components) {
      if (comp instanceof PublicKey) {
        hash.update(comp.toBuffer());
      } else if (typeof comp === 'number') {
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64LE(BigInt(comp));
        hash.update(buf);
      } else {

        hash.update(comp);
      }
    }

    return hash.digest();
  }


  before(async () => {
    pdas = calculatePDAs(mint.publicKey, program.programId);

    const [multisig] = PublicKey.findProgramAddressSync(
      [Buffer.from("multisig"), mint.publicKey.toBuffer()],
      program.programId
    );
    multisigPda = multisig;

    // Fund accounts
    const fundAccounts = [
      regularUser1.publicKey,
      regularUser2.publicKey,
      blacklistedUser.publicKey,
      mintAuthorityUser.publicKey,
      testContract.publicKey,
      owner1.publicKey,
      owner2.publicKey,
      owner3.publicKey
    ];

    for (const account of fundAccounts) {
      await provider.connection.requestAirdrop(account, 2 * anchor.web3.LAMPORTS_PER_SOL);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("Initializing token...");
    await createMultisig(connection, payer, [owner1.publicKey, owner2.publicKey, owner3.publicKey], 2, splMultisig, null, TOKEN_2022_PROGRAM_ID);
    await createMintAccountWithExtensions(
      provider,
      mint,
      TOKEN_PARAMS,
      pdas.mintAuthority,
      splMultisig.publicKey,
    )
    await initializeToken(program, provider, mint, pdas, payer.publicKey);
    console.log("Initializing multisig...");

    console.log("Initializing multisig...");
    await initializeMultisig(program, provider, mint, pdas, [owner1.publicKey, owner2.publicKey], threshold)
    const users = [regularUser1, regularUser2, mintAuthorityUser];
    const userAccounts = await setupUserAccounts(provider, users, mint.publicKey);

    [
      regularUser1TokenAccount,
      regularUser2TokenAccount,
      mintAuthorityUserTokenAccount,

    ] = userAccounts;

    console.log("Multisig initialized at:", multisigPda.toString());

    let multisigAccount = await program.account.multisig.fetch(multisigPda);

    // Build message
    let message = buildMessageHash(
      "ADD_CAN_MINT",
      pdas.canMint,
      mintAuthorityUser.publicKey,
      multisigAccount.nonce.toNumber()
    );

    // Create Ed25519 instructions for threshold number of signers
    const ed25519Ix1 = createEd25519Ix(owner1, message);
    const ed25519Ix2 = createEd25519Ix(owner2, message);

    const tx = await program.methods
      .addCanMint(mintAuthorityUser.publicKey)
      .accounts({
        mint: mint.publicKey,
        //@ts-ignore
        tokenConfig: pdas.tokenConfig,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts,
        multisig: multisigPda,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY
      })
      .preInstructions([ed25519Ix1, ed25519Ix2])
      .rpc();

    console.log("Added mint authority tx:", tx);

    const canMintAccount = await program.account.canMint.fetch(pdas.canMint);
    const authorityFound = canMintAccount.authorities.some(auth =>
      auth.equals(mintAuthorityUser.publicKey)
    );
    assert.isTrue(authorityFound, "Mint authority was not added");

    multisigAccount = await program.account.multisig.fetch(multisigPda);

    message = buildMessageHash(
      "SET_MINT_AMOUNT",
      pdas.canMint,
      mintAuthorityUser.publicKey,
      TEST_TOKEN_PARAMS.mintAmount.toNumber(),
      multisigAccount.nonce.toNumber()
    );

    const mintAmounted25519Ix1 = createEd25519Ix(owner1, message);
    const mintAmounted25519Ix2 = createEd25519Ix(owner2, message);

    const mintAmountTx = await program.methods
      .setMintAmount(mintAuthorityUser.publicKey, TEST_TOKEN_PARAMS.mintAmount)
      .accounts({
        multisig: multisigPda,
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        canMint: pdas.canMint,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY
      })
      .preInstructions([mintAmounted25519Ix1, mintAmounted25519Ix2])
      .rpc();

    console.log("Set mint amount tx:", mintAmountTx);

    // Fetch and verify the mint amount
    const fetchedAmount = await program.methods
      .getMintAmount(mintAuthorityUser.publicKey)
      .accounts({
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        canMint: pdas.canMint
      })
      .view();
    console.log(fetchedAmount.toString())
    assert.equal(
      fetchedAmount.toString(),
      TEST_TOKEN_PARAMS.mintAmount.toString(),
      "Mint amount was not set correctly"
    );
    await program.methods
      .mint(TEST_TOKEN_PARAMS.mintAmount)
      .accounts({
        authority: mintAuthorityUser.publicKey,
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        mintAuthority: pdas.mintAuthority,
        tokenAccount: regularUser1TokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,

        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts
      })
      .signers([mintAuthorityUser])
      .rpc();
  });



  it('Should transfer tokens using permanent delegate', async () => {
    console.log("\n=== Test: Transfer with Permanent Delegate ===\n");

    const transferAmount = new anchor.BN(100_000_000_000); // 100 tokens

    const beforeBalanceA = await getAccount(
      provider.connection,
      regularUser1TokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    const beforeBalanceB = await getAccount(
      provider.connection,
      regularUser2TokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    // Permanent delegate (payer) can transfer without owner signature
    let ix = createTransferCheckedInstruction(
      regularUser1TokenAccount,
      mint.publicKey,
      regularUser2TokenAccount,
      splMultisig.publicKey,
      Number(transferAmount),
      TEST_TOKEN_PARAMS.decimals,
      [owner1, owner2, owner3], // Additional signers
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new Transaction();
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = provider.wallet.publicKey; // 👈 Set fee payer FIRST
    tx.add(ix);
    tx.partialSign(owner1, owner2, owner3); // 👈 Then sign

    await provider.sendAndConfirm(tx, []); // Already signed, no additional signers needed

    console.log("✅ Transfer completed");


    const afterBalanceA = await getAccount(
      provider.connection,
      regularUser1TokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    const afterBalanceB = await getAccount(
      provider.connection,
      regularUser2TokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    assert.equal(
      (BigInt(beforeBalanceA.amount.toString()) - BigInt(transferAmount.toString())).toString(),
      afterBalanceA.amount.toString(),
      "UserA balance should decrease"
    );

    assert.equal(
      (BigInt(beforeBalanceB.amount.toString()) + BigInt(transferAmount.toString())).toString(),
      afterBalanceB.amount.toString(),
      "UserB balance should increase"
    );

    console.log(`✅ UserA balance: ${afterBalanceA.amount.toString()}`);
    console.log(`✅ UserB balance: ${afterBalanceB.amount.toString()}\n`);
  });

  it('Should freeze account using permanent delegate', async () => {
    console.log("\n=== Test: Freeze Account ===\n");

    let ix = createFreezeAccountInstruction(
      regularUser1TokenAccount,
      mint.publicKey,
      splMultisig.publicKey,
      [owner1.publicKey, owner2.publicKey],
      TOKEN_2022_PROGRAM_ID
    )

    const tx = new Transaction();
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = provider.wallet.publicKey; // 👈 Set fee payer FIRST
    tx.add(ix);
    tx.partialSign(owner1, owner2); // 👈 Then sign

    await provider.sendAndConfirm(tx, []); // Already signed, no additional signers needed




    console.log("✅ Account frozen");

    const tokenAccountInfo = await getAccount(
      provider.connection,
      regularUser1TokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    assert.isTrue(tokenAccountInfo.isFrozen, "Account should be frozen");
    console.log("✅ Account is frozen\n");
  });

  it('Should thaw account using permanent delegate', async () => {
    console.log("\n=== Test: Thaw Account ===\n");

    let ix = createThawAccountInstruction(
      regularUser1TokenAccount,
      mint.publicKey,
      splMultisig.publicKey, // Freeze authority (SPL Multisig)
      [owner1.publicKey, owner2.publicKey], // Multisig signers
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new Transaction();
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = provider.wallet.publicKey;
    tx.add(ix);
    tx.partialSign(owner1, owner2);

    await provider.sendAndConfirm(tx, []);

    console.log("✅ Account thawed");

    const tokenAccountInfo = await getAccount(
      provider.connection,
      regularUser1TokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    assert.isFalse(tokenAccountInfo.isFrozen, "Account should not be frozen");
    console.log("✅ Account is thawed\n");
  });

  it('Should burn tokens using permanent delegate', async () => {
    console.log("\n=== Test: Burn with Permanent Delegate ===\n");

    const burnAmount = new anchor.BN(50_000_000_000); // 50 tokens

    const beforeBalance = await getAccount(
      provider.connection,
      regularUser1TokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    let ix = createBurnCheckedInstruction(
      regularUser1TokenAccount, // Account to burn from
      mint.publicKey, // Mint
      splMultisig.publicKey, // Permanent delegate (SPL Multisig)
      Number(burnAmount), // Amount
      TEST_TOKEN_PARAMS.decimals, // Decimals
      [owner1.publicKey, owner2.publicKey], // Multisig signers
      TOKEN_2022_PROGRAM_ID
    );

    // const tx = new Transaction();
    // tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
    // tx.feePayer = provider.wallet.publicKey;
    // tx.add(ix);
    // tx.partialSign(owner1, owner2);

    //await provider.sendAndConfirm(tx, []);

    // Build transaction
    const tx = new Transaction();
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = provider.wallet.publicKey;
    tx.add(ix);

    // Using KMS to sign alternative
    // Serialize the transaction message to send to KMS for signing
    const messageToSign = tx.serializeMessage();

    // Get signatures from KMS (pseudo-code - depends on your KMS provider)
    // const signature1 = await kmsProvider.sign(owner1PublicKey, messageToSign);
    // const signature2 = await kmsProvider.sign(owner2PublicKey, messageToSign);

    // For testing with local keys:
    const signature1 = nacl.sign.detached(messageToSign, owner1.secretKey);
    const signature2 = nacl.sign.detached(messageToSign, owner2.secretKey);
    const signature3 = nacl.sign.detached(messageToSign, payer.secretKey);

    // Add signatures to transaction
    tx.addSignature(owner1.publicKey, Buffer.from(signature1));
    tx.addSignature(owner2.publicKey, Buffer.from(signature2));
    tx.addSignature(payer.publicKey, Buffer.from(signature3));

    // Send the signed transaction
    const signature = await provider.connection.sendRawTransaction(tx.serialize());
    await provider.connection.confirmTransaction(signature);

    console.log("✅ Burn completed");

    const afterBalance = await getAccount(
      provider.connection,
      regularUser1TokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    assert.equal(
      (BigInt(beforeBalance.amount.toString()) - BigInt(burnAmount.toString())).toString(),
      afterBalance.amount.toString(),
      "Balance should decrease by burn amount"
    );

    console.log(`✅ Tokens burned. New balance: ${afterBalance.amount.toString()}\n`);
  });
});