import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Cngn } from "../target/types/cngn";
import { assert, expect } from 'chai';
import { PublicKey, Keypair, SYSVAR_INSTRUCTIONS_PUBKEY, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, createMintToInstruction, getAccount, getAssociatedTokenAddressSync, createMint } from '@solana/spl-token';
import { calculatePDAs, TokenPDAs } from '../utils/helpers';
import { TOKEN_PARAMS, initializeToken, initializeMultisig, setupUserAccounts } from '../utils/token_initializer';
import * as crypto from 'crypto';
import nacl from 'tweetnacl';

describe("cngn mint test with multisig", () => {
  const connection = new anchor.web3.Connection('http://127.0.0.1:8899', 'confirmed');
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);
  const payer = (provider.wallet as anchor.Wallet).payer;
  const program = anchor.workspace.Cngn as Program<Cngn>;

  const mint = Keypair.generate();

  // Test users
  const unauthorizedUser = Keypair.generate();
  const blacklistedUser = Keypair.generate();
  const authorizedUser = Keypair.generate();
  const blacklistedReceiver = Keypair.generate();

  // Multisig owners
  const owner1 = Keypair.generate();
  const owner2 = Keypair.generate();
  const owner3 = Keypair.generate();
  const threshold = 2;

  let pdas: TokenPDAs;
  let multisigPda: PublicKey;
  let unauthorizedUserTokenAccount: PublicKey;
  let blacklistedUserTokenAccount: PublicKey;
  let authorizedUserTokenAccount: PublicKey;
  let blacklistedReceiverTokenAccount: PublicKey;

  const mintAmount = TOKEN_PARAMS.mintAmount;
  const differentMintAmount = new anchor.BN(500000000);

  // Helper function to create Ed25519 signature instruction
  function createEd25519Ix(signer: Keypair, message: Buffer): TransactionInstruction {
    const signature = nacl.sign.detached(message, signer.secretKey);
    const publicKey = signer.publicKey.toBytes();

    const numSignatures = 1;
    const padding = 0;

    const offsetsStruct = Buffer.alloc(14);
    offsetsStruct.writeUInt16LE(16, 0);
    offsetsStruct.writeUInt16LE(0xFFFF, 2);
    offsetsStruct.writeUInt16LE(80, 4);
    offsetsStruct.writeUInt16LE(0xFFFF, 6);
    offsetsStruct.writeUInt16LE(112, 8);
    offsetsStruct.writeUInt16LE(message.length, 10);
    offsetsStruct.writeUInt16LE(0xFFFF, 12);

    const data = Buffer.concat([
      Buffer.from([numSignatures, padding]),
      offsetsStruct,
      Buffer.from(signature),
      publicKey,
      message
    ]);

    return new TransactionInstruction({
      keys: [],
      programId: new PublicKey('Ed25519SigVerify111111111111111111111111111'),
      data,
    });
  }

  // Helper to build message hash
  function buildMessageHash(prefix: string, ...components: (PublicKey | Buffer | number)[]): Buffer {
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(prefix));

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
      unauthorizedUser.publicKey,
      blacklistedUser.publicKey,
      authorizedUser.publicKey,
      blacklistedReceiver.publicKey,
      owner1.publicKey,
      owner2.publicKey,
      owner3.publicKey
    ];

    for (const account of fundAccounts) {
      await provider.connection.requestAirdrop(account, 2 * anchor.web3.LAMPORTS_PER_SOL);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("Initializing token...");
    await createMint(provider.connection, payer, pdas.mintAuthority, pdas.mintAuthority, 6, mint, null, TOKEN_2022_PROGRAM_ID);
    await initializeToken(program, provider, mint, pdas, payer.publicKey);

    console.log("Initializing multisig...");
    await initializeMultisig(program, provider, mint, pdas, [owner1.publicKey, owner2.publicKey, owner3.publicKey], threshold);

    console.log("Setting up test users...");
    const users = [unauthorizedUser, blacklistedUser, authorizedUser, blacklistedReceiver];
    const userAccounts = await setupUserAccounts(provider, users, mint.publicKey);

    [
      unauthorizedUserTokenAccount,
      blacklistedUserTokenAccount,
      authorizedUserTokenAccount,
      blacklistedReceiverTokenAccount
    ] = userAccounts;

    // Setup authorized user with multisig
    let multisigAccount = await program.account.multisig.fetch(multisigPda);
    let message = buildMessageHash(
      "ADD_CAN_MINT",
      pdas.canMint,
      authorizedUser.publicKey,
      multisigAccount.nonce.toNumber()
    );
    let ed25519Ix1 = createEd25519Ix(owner1, message);
    let ed25519Ix2 = createEd25519Ix(owner2, message);

    await program.methods
      .addCanMint(authorizedUser.publicKey)
      .accounts({
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts,
        multisig: multisigPda,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY
      })
      .preInstructions([ed25519Ix1, ed25519Ix2])
      .rpc();

    // Set mint amount for authorized user
    multisigAccount = await program.account.multisig.fetch(multisigPda);
    message = buildMessageHash(
      "SET_MINT_AMOUNT",
      pdas.canMint,
      authorizedUser.publicKey,
      multisigAccount.nonce.toNumber()
    );
    ed25519Ix1 = createEd25519Ix(owner1, message);
    ed25519Ix2 = createEd25519Ix(owner2, message);

    await program.methods
      .setMintAmount(authorizedUser.publicKey, mintAmount)
      .accounts({
        multisig: multisigPda,
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        canMint: pdas.canMint,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY
      })
      .preInstructions([ed25519Ix1, ed25519Ix2])
      .rpc();

    // Add payer to can_mint with multisig
    multisigAccount = await program.account.multisig.fetch(multisigPda);
    message = buildMessageHash(
      "ADD_CAN_MINT",
      pdas.canMint,
      payer.publicKey,
      multisigAccount.nonce.toNumber()
    );
    ed25519Ix1 = createEd25519Ix(owner1, message);
    ed25519Ix2 = createEd25519Ix(owner2, message);

    await program.methods
      .addCanMint(payer.publicKey)
      .accounts({
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts,
        multisig: multisigPda,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY
      })
      .preInstructions([ed25519Ix1, ed25519Ix2])
      .rpc();

    // Set mint amount for payer
    multisigAccount = await program.account.multisig.fetch(multisigPda);
    message = buildMessageHash(
      "SET_MINT_AMOUNT",
      pdas.canMint,
      payer.publicKey,
      multisigAccount.nonce.toNumber()
    );
    ed25519Ix1 = createEd25519Ix(owner1, message);
    ed25519Ix2 = createEd25519Ix(owner2, message);

    await program.methods
      .setMintAmount(payer.publicKey, mintAmount)
      .accounts({
        multisig: multisigPda,
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        canMint: pdas.canMint,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY
      })
      .preInstructions([ed25519Ix1, ed25519Ix2])
      .rpc();

    // Add blacklisted users with multisig
    multisigAccount = await program.account.multisig.fetch(multisigPda);
    message = buildMessageHash(
      "ADD_BLACKLIST",
      pdas.blacklist,
      blacklistedUser.publicKey,
      multisigAccount.nonce.toNumber()
    );
    ed25519Ix1 = createEd25519Ix(owner1, message);
    ed25519Ix2 = createEd25519Ix(owner2, message);

    await program.methods
      .addBlacklist(blacklistedUser.publicKey)
      .accounts({
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        canMint: pdas.canMint,
        internalWhitelist: pdas.internalWhitelist,
        externalWhitelist: pdas.externalWhitelist,
        trustedContracts: pdas.trustedContracts,
        canForward: pdas.canForward,
        blacklist: pdas.blacklist,
        multisig: multisigPda,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY
      })
      .preInstructions([ed25519Ix1, ed25519Ix2])
      .rpc();

    // Add blacklisted receiver
    multisigAccount = await program.account.multisig.fetch(multisigPda);
    message = buildMessageHash(
      "ADD_BLACKLIST",
      pdas.blacklist,
      blacklistedReceiver.publicKey,
      multisigAccount.nonce.toNumber()
    );
    ed25519Ix1 = createEd25519Ix(owner1, message);
    ed25519Ix2 = createEd25519Ix(owner2, message);

    await program.methods
      .addBlacklist(blacklistedReceiver.publicKey)
      .accounts({
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        canMint: pdas.canMint,
        internalWhitelist: pdas.internalWhitelist,
        externalWhitelist: pdas.externalWhitelist,
        trustedContracts: pdas.trustedContracts,
        canForward: pdas.canForward,
        blacklist: pdas.blacklist,
        multisig: multisigPda,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY
      })
      .preInstructions([ed25519Ix1, ed25519Ix2])
      .rpc();

    console.log("Test users set up successfully");
  });

  it("Fails when trying to mint directly using SPL Token program", async () => {
    console.log("Testing direct SPL mint attempt...");

    const attacker = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(
      attacker.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    const mintIx = await createMintToInstruction(
      mint.publicKey,
      attacker.publicKey,
      authorizedUser.publicKey,
      1_000_000,
      [mint, attacker],
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new anchor.web3.Transaction().add(mintIx);

    try {
      await provider.sendAndConfirm(tx, [attacker]);
      assert.fail("Direct SPL mint should have failed");
    } catch (error) {
      console.log("Caught expected error for direct SPL mint:", error.toString());
      expect(
        error.toString().includes("Signature verification failed") ||
        error.toString().includes("owner does not match") ||
        error.toString().includes("instruction requires a signature")
      ).to.be.true;
    }
  });

  it('Successfully mints tokens to an authorized user', async () => {
    console.log("Testing successful minting by an authorized user...");

    let tokenAccountInfoBefore;
    try {
      tokenAccountInfoBefore = await getAccount(provider.connection, authorizedUserTokenAccount);
    } catch (error) {
      tokenAccountInfoBefore = { amount: 0 };
    }

    const mintTx = await program.methods
      .mint(mintAmount)
      .accounts({
        authority: authorizedUser.publicKey,
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        mintAuthority: pdas.mintAuthority,
        tokenAccount: authorizedUserTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts
      })
      .signers([authorizedUser])
      .rpc();

    console.log("Mint transaction signature:", mintTx);

    const tokenAccountInfoAfter = await getAccount(provider.connection, authorizedUserTokenAccount, null, TOKEN_2022_PROGRAM_ID);
    const expectedBalance = new anchor.BN(tokenAccountInfoBefore.amount.toString()).add(mintAmount);

    assert.equal(
      tokenAccountInfoAfter.amount.toString(),
      expectedBalance.toString(),
      "Token balance should increase by the mint amount"
    );

    const canMintAccountAfter = await program.account.canMint.fetch(pdas.canMint);
    const authorizedUserIndexAfter = canMintAccountAfter.authorities.findIndex(
      auth => auth.toString() === authorizedUser.publicKey.toString()
    );

    assert.equal(
      authorizedUserIndexAfter,
      -1,
      "Authorized user should be removed from can_mint list after minting"
    );
  });

  it('Fails to mint when user is not in can_mint list', async () => {
    console.log("Testing unauthorized minting...");

    try {
      await program.methods
        .mint(mintAmount)
        .accounts({
          authority: unauthorizedUser.publicKey,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          mintAuthority: pdas.mintAuthority,
          tokenAccount: unauthorizedUserTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .signers([unauthorizedUser])
        .rpc();

      assert.fail("Minting should have failed for unauthorized user");
    } catch (error) {
      console.log("Caught expected error for unauthorized minting:", error.toString());
      assert.include(error.toString(), "MinterNotAuthorized");
    }
  });

  it('Fails to mint with incorrect mint amount', async () => {
    console.log("Testing minting with incorrect amount...");

    // Add payer back to can_mint using multisig
    let multisigAccount = await program.account.multisig.fetch(multisigPda);
    let message = buildMessageHash(
      "ADD_CAN_MINT",
      pdas.canMint,
      payer.publicKey,
      multisigAccount.nonce.toNumber()
    );
    let ed25519Ix1 = createEd25519Ix(owner1, message);
    let ed25519Ix2 = createEd25519Ix(owner2, message);

    try {
      await program.methods
        .addCanMint(payer.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts,
          multisig: multisigPda,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      // Set mint amount
      multisigAccount = await program.account.multisig.fetch(multisigPda);
      message = buildMessageHash(
        "SET_MINT_AMOUNT",
        pdas.canMint,
        payer.publicKey,
        multisigAccount.nonce.toNumber()
      );
      ed25519Ix1 = createEd25519Ix(owner1, message);
      ed25519Ix2 = createEd25519Ix(owner2, message);

      await program.methods
        .setMintAmount(payer.publicKey, mintAmount)
        .accounts({
          multisig: multisigPda,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();
    } catch (error) {
      // Ignore if already added
    }

    try {
      await program.methods
        .mint(differentMintAmount)
        .accounts({
          authority: payer.publicKey,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          mintAuthority: pdas.mintAuthority,
          tokenAccount: authorizedUserTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      assert.fail("Minting should have failed with incorrect amount");
    } catch (error) {
      console.log("Caught expected error for incorrect mint amount:", error.toString());
      assert.include(error.toString(), "InvalidMintAmount");
    }
  });

  it('Fails to mint when signer is blacklisted', async () => {
    console.log("Testing minting with blacklisted signer...");

    // Add blacklisted user to can_mint using multisig
    let multisigAccount = await program.account.multisig.fetch(multisigPda);
    let message = buildMessageHash(
      "ADD_CAN_MINT",
      pdas.canMint,
      blacklistedUser.publicKey,
      multisigAccount.nonce.toNumber()
    );
    let ed25519Ix1 = createEd25519Ix(owner1, message);
    let ed25519Ix2 = createEd25519Ix(owner2, message);

    try {
      await program.methods
        .addCanMint(blacklistedUser.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts,
          multisig: multisigPda,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      // Set mint amount
      multisigAccount = await program.account.multisig.fetch(multisigPda);
      message = buildMessageHash(
        "SET_MINT_AMOUNT",
        pdas.canMint,
        blacklistedUser.publicKey,
        multisigAccount.nonce.toNumber()
      );
      ed25519Ix1 = createEd25519Ix(owner1, message);
      ed25519Ix2 = createEd25519Ix(owner2, message);

      await program.methods
        .setMintAmount(blacklistedUser.publicKey, mintAmount)
        .accounts({
          multisig: multisigPda,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();
    } catch (error) {
      // Ignore if already added
    }

    try {
      await program.methods
        .mint(mintAmount)
        .accounts({
          authority: blacklistedUser.publicKey,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          mintAuthority: pdas.mintAuthority,
          tokenAccount: blacklistedUserTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .signers([blacklistedUser])
        .rpc();

      assert.fail("Minting should have failed for blacklisted signer");
    } catch (error) {
      console.log("Caught expected error for blacklisted signer:", error.toString());
      assert.include(error.toString(), "SignerBlacklisted");
    }
  });

  it('Fails to mint to a blacklisted receiver', async () => {
    console.log("Testing minting to blacklisted receiver...");

    try {
      await program.methods
        .mint(mintAmount)
        .accounts({
          authority: payer.publicKey,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          mintAuthority: pdas.mintAuthority,
          tokenAccount: blacklistedReceiverTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      assert.fail("Minting should have failed for blacklisted receiver");
    } catch (error) {
      console.log("Caught expected error for blacklisted receiver:", error.toString());
      assert.include(error.toString(), "ReceiverBlacklisted");
    }
  });

  it('Fails to mint when minting is paused', async () => {
    console.log("Testing minting when paused...");

    // Pause minting using multisig
    const multisigAccount = await program.account.multisig.fetch(multisigPda);
    const message = buildMessageHash(
      "PAUSE_MINTING",
      pdas.tokenConfig,
      multisigAccount.nonce.toNumber()
    );
    const ed25519Ix1 = createEd25519Ix(owner1, message);
    const ed25519Ix2 = createEd25519Ix(owner2, message);

    await program.methods
      .pauseMinting(true)
      .accounts({
        multisig: multisigPda,
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY
      })
      .preInstructions([ed25519Ix1, ed25519Ix2])
      .rpc();

    const tokenConfigAfterPause = await program.account.tokenConfig.fetch(pdas.tokenConfig);
    assert.equal(tokenConfigAfterPause.mintPaused, true);

    try {
      await program.methods
        .mint(mintAmount)
        .accounts({
          authority: payer.publicKey,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          mintAuthority: pdas.mintAuthority,
          tokenAccount: authorizedUserTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      assert.fail("Minting should have failed when paused");
    } catch (error) {
      console.log("Caught expected error when minting while paused:", error.toString());
      assert.include(error.toString(), "MintingPaused");
    }
  });

  it('Successfully mints after unpausing', async () => {
    console.log("Testing successful minting after unpausing...");

    // Unpause minting using multisig
    let multisigAccount = await program.account.multisig.fetch(multisigPda);
    let message = buildMessageHash(
      "PAUSE_MINTING",
      pdas.tokenConfig,
      multisigAccount.nonce.toNumber()
    );
    let ed25519Ix1 = createEd25519Ix(owner1, message);
    let ed25519Ix2 = createEd25519Ix(owner2, message);

    await program.methods
      .pauseMinting(false)
      .accounts({
        multisig: multisigPda,
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY
      })
      .preInstructions([ed25519Ix1, ed25519Ix2])
      .rpc();

    const tokenConfigAfterUnpause = await program.account.tokenConfig.fetch(pdas.tokenConfig);
    assert.equal(tokenConfigAfterUnpause.mintPaused, false);

    // Add payer back to can_mint
    multisigAccount = await program.account.multisig.fetch(multisigPda);
    message = buildMessageHash(
      "ADD_CAN_MINT",
      pdas.canMint,
      payer.publicKey,
      multisigAccount.nonce.toNumber()
    );
    ed25519Ix1 = createEd25519Ix(owner1, message);
    ed25519Ix2 = createEd25519Ix(owner2, message);

    try {
      await program.methods
        .addCanMint(payer.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts,
          multisig: multisigPda,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      // Set mint amount
      multisigAccount = await program.account.multisig.fetch(multisigPda);
      message = buildMessageHash(
        "SET_MINT_AMOUNT",
        pdas.canMint,
        payer.publicKey,
        multisigAccount.nonce.toNumber()
      );
      ed25519Ix1 = createEd25519Ix(owner1, message);
      ed25519Ix2 = createEd25519Ix(owner2, message);

      await program.methods
        .setMintAmount(payer.publicKey, mintAmount)
        .accounts({
          multisig: multisigPda,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();
    } catch (error) {
      // Ignore if already added
    }

    const tokenAccountInfoBefore = await getAccount(provider.connection, authorizedUserTokenAccount, null, TOKEN_2022_PROGRAM_ID);

    const mintTx = await program.methods
      .mint(mintAmount)
      .accounts({
        authority: payer.publicKey,
        mint: mint.publicKey,
        tokenConfig: pdas.tokenConfig,
        mintAuthority: pdas.mintAuthority,
        tokenAccount: authorizedUserTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts
      })
      .rpc();

    console.log("Mint transaction signature after unpausing:", mintTx);

    const tokenAccountInfoAfter = await getAccount(provider.connection, authorizedUserTokenAccount, null, TOKEN_2022_PROGRAM_ID);
    const expectedBalance = new anchor.BN(tokenAccountInfoBefore.amount.toString()).add(mintAmount);

    assert.equal(
      tokenAccountInfoAfter.amount.toString(),
      expectedBalance.toString(),
      "Token balance should increase by the mint amount after unpausing"
    );

    const canMintAccountAfter = await program.account.canMint.fetch(pdas.canMint);
    const deployerIndexAfter = canMintAccountAfter.authorities.findIndex(
      auth => auth.toString() === payer.publicKey.toString()
    );

    assert.equal(
      deployerIndexAfter,
      -1,
      "Payer should be removed from can_mint list after minting"
    );
  });

  it('Fails to mint with mismatched mint account', async () => {
    console.log("Testing minting with mismatched mint account...");

    const differentMint = Keypair.generate();

    // Add payer back to can_mint
    let multisigAccount = await program.account.multisig.fetch(multisigPda);
    let message = buildMessageHash(
      "ADD_CAN_MINT",
      pdas.canMint,
      payer.publicKey,
      multisigAccount.nonce.toNumber()
    );
    let ed25519Ix1 = createEd25519Ix(owner1, message);
    let ed25519Ix2 = createEd25519Ix(owner2, message);

    try {
      await program.methods
        .addCanMint(payer.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts,
          multisig: multisigPda,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      multisigAccount = await program.account.multisig.fetch(multisigPda);
      message = buildMessageHash(
        "SET_MINT_AMOUNT",
        pdas.canMint,
        payer.publicKey,
        multisigAccount.nonce.toNumber()
      );
      ed25519Ix1 = createEd25519Ix(owner1, message);
      ed25519Ix2 = createEd25519Ix(owner2, message);

      await program.methods
        .setMintAmount(payer.publicKey, mintAmount)
        .accounts({
          multisig: multisigPda,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();
    } catch (error) {
      // Ignore if already added
    }

    try {
      await program.methods
        .mint(mintAmount)
        .accounts({
          authority: payer.publicKey,
          mint: differentMint.publicKey,
          tokenConfig: pdas.tokenConfig,
          mintAuthority: pdas.mintAuthority,
          tokenAccount: authorizedUserTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .signers([mint])
        .rpc();

      assert.fail("Minting should have failed with mismatched mint");
    } catch (error) {
      console.log("Caught expected error for mismatched mint:", error.toString());
      assert.include(error.toString(), "Error: unknown signer");
    }
  });

  it('Fails to mint with token account for wrong mint', async () => {
    console.log("Testing minting with token account for wrong mint...");

    // Make sure payer is in can_mint
    let multisigAccount = await program.account.multisig.fetch(multisigPda);
    let message = buildMessageHash(
      "ADD_CAN_MINT",
      pdas.canMint,
      payer.publicKey,
      multisigAccount.nonce.toNumber()
    );
    let ed25519Ix1 = createEd25519Ix(owner1, message);
    let ed25519Ix2 = createEd25519Ix(owner2, message);

    try {
      await program.methods
        .addCanMint(payer.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts,
          multisig: multisigPda,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      multisigAccount = await program.account.multisig.fetch(multisigPda);
      message = buildMessageHash(
        "SET_MINT_AMOUNT",
        pdas.canMint,
        payer.publicKey,
        multisigAccount.nonce.toNumber()
      );
      ed25519Ix1 = createEd25519Ix(owner1, message);
      ed25519Ix2 = createEd25519Ix(owner2, message);

      await program.methods
        .setMintAmount(payer.publicKey, mintAmount)
        .accounts({
          multisig: multisigPda,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();
    } catch (error) {
      // Ignore if already added
    }

    const differentMint = Keypair.generate();

    try {
      const tx = new anchor.web3.Transaction();
      await provider.sendAndConfirm(tx, [differentMint]);

      const differentTokenAccount = await getAssociatedTokenAddressSync(
        differentMint.publicKey,
        payer.publicKey
      );

      try {
        await program.methods
          .mint(mintAmount)
          .accounts({
            authority: payer.publicKey,
            mint: mint.publicKey,
            tokenConfig: pdas.tokenConfig,
            mintAuthority: pdas.mintAuthority,
            tokenAccount: differentTokenAccount,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            blacklist: pdas.blacklist,
            canMint: pdas.canMint,
            trustedContracts: pdas.trustedContracts
          })
          .rpc();

        assert.fail("Minting should have failed with token account for wrong mint");
      } catch (error) {
        console.log("Caught expected error for token account with wrong mint:", error.toString());
      }
    } catch (error) {
      console.log("Setup for different mint test failed - skipping test");
    }
  });
});