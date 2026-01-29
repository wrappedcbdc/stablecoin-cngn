
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Cngn } from "../target/types/cngn";
import { assert, expect } from 'chai';
import { PublicKey, Keypair, SYSVAR_INSTRUCTIONS_PUBKEY, TransactionInstruction } from '@solana/web3.js';
import { calculatePDAs, createMintAccountWithExtensions } from '../utils/helpers';
import { initializeMultisig, initializeToken, TOKEN_PARAMS } from "../utils/token_initializer";
import * as crypto from 'crypto';
import nacl from 'tweetnacl';
import { createMint, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import { transferMintAuthority } from "../utils/transfer_mint_authority";
import { transferAuthorityToPDA } from "./transfer-authority-to-pda";
import { createEd25519Ix } from "../utils/multisig_helpers";


describe("cngn admin functionality tests with multisig", () => {
  const connection = new anchor.web3.Connection('http://127.0.0.1:8899', 'confirmed');
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);
  const payer = (provider.wallet as anchor.Wallet).payer;
  const program = anchor.workspace.Cngn as Program<Cngn>;

  const mint = Keypair.generate();
  const anotherCngnmint = Keypair.generate();
  const otherAdmin = Keypair.generate();
  const testContract = Keypair.generate();
  const regularUser1 = Keypair.generate();
  const regularUser2 = Keypair.generate();
  const blacklistedUser = Keypair.generate();
  const mintAuthorityUser = Keypair.generate();

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

    // Helper for building multisig update message with multiple owners
    function buildMultisigUpdateMessage(
      multisigKey: PublicKey,
      newOwners: PublicKey[],
      newThreshold: number,
      nonce: number
    ): Buffer {
      const hash = crypto.createHash('sha256');
      hash.update(Buffer.from('UPDATE_MULTISIG_V1'));
      hash.update(multisigKey.toBuffer());
  
      // Add each owner
      for (const owner of newOwners) {
        hash.update(owner.toBuffer());
      }
  
      // Add threshold as single byte
      const thresholdBuf = Buffer.alloc(1);
      thresholdBuf.writeUInt8(newThreshold);
      hash.update(thresholdBuf);
  
      // Add nonce as 8 bytes little-endian
      const nonceBuf = Buffer.alloc(8);
      nonceBuf.writeBigUInt64LE(BigInt(nonce));
      hash.update(nonceBuf);
  
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
      otherAdmin.publicKey,
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
    
  await createMintAccountWithExtensions(
      provider,
      mint,
      TOKEN_PARAMS,
      pdas.mintAuthority,
      payer.publicKey,
    )
    await createMint(provider.connection, payer, payer.publicKey, payer.publicKey, 6, anotherCngnmint, null, TOKEN_2022_PROGRAM_ID)

    await initializeToken(program, provider, mint, pdas, payer.publicKey);
    console.log("Initializing multisig...");

    console.log("Initializing multisig...");
    await initializeMultisig(program, provider, mint, pdas, [owner1.publicKey, owner2.publicKey], threshold)


    console.log("Multisig initialized at:", multisigPda.toString());
  });

  describe("Initialization Security Tests", () => {

    let anotherPdas = calculatePDAs(anotherCngnmint.publicKey, program.programId);
    console.log("Another cNGN mint:=======", anotherCngnmint.publicKey.toString());
    console.log("cNGN mint:", mint.publicKey.toString());
    it("Cannot initialize token twice", async () => {
      console.log("Testing double initialization prevention...");

      try {
        await initializeToken(program, provider, mint, pdas, payer.publicKey);
        assert.fail();
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        // The account is already in use, which prevents reinitialization
        assert.include(error.toString(), "already in use");
      }
    });
    it("Cannot initialize multisig twice", async () => {
      console.log("Testing double multisig initialization prevention...");

      try {
        await initializeMultisig(
          program,
          provider,
          mint,
          pdas,
          [owner1.publicKey, owner2.publicKey],
          threshold
        );

      } catch (error) {
        console.log("Caught expected error:", error.toString());
        // Anchor will throw an error because the account already exists
        assert.include(error.toString(), "already in use");
      }
    });
    it("Cannot initialize token twice even with different mint and pdas", async () => {
      console.log("Testing double initialization prevention...");

      try {
        await initializeToken(program, provider, anotherCngnmint, anotherPdas, payer.publicKey);

      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "TokenAlreadyInitialized");
      }
    });

    it("Cannot initialize multisig twice even with different mint and pdas", async () => {
      console.log("Testing double multisig initialization prevention...");

      try {
        await initializeMultisig(
          program,
          provider,
          anotherCngnmint,
          anotherPdas,
          [owner1.publicKey, owner2.publicKey],
          threshold
        );

      } catch (error) {
        console.log("Caught expected error:", error.toString());
        // Anchor will throw an error because the account already exists
        assert.include(error.toString(), "already in use");
      }
    });
  });

  describe("CanMint Admin Tests", () => {
    it("Admin can add a mint authority with multisig", async () => {
      console.log("Testing adding mint authority with multisig...");

      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      // Build message
      const message = buildMessageHash(
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
    });

    it("Admin can set mint amount with multisig", async () => {
      console.log("Testing setting mint amount with multisig...");

      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      const message = buildMessageHash(
        "SET_MINT_AMOUNT",
        pdas.canMint,
        mintAuthorityUser.publicKey,
        TOKEN_PARAMS.mintAmount.toNumber(),
        multisigAccount.nonce.toNumber()
      );

      const ed25519Ix1 = createEd25519Ix(owner1, message);
      const ed25519Ix2 = createEd25519Ix(owner2, message);

      const tx = await program.methods
        .setMintAmount(mintAuthorityUser.publicKey, TOKEN_PARAMS.mintAmount)
        .accounts({
          multisig: multisigPda,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      console.log("Set mint amount tx:", tx);

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
        TOKEN_PARAMS.mintAmount.toString(),
        "Mint amount was not set correctly"
      );
    });

    it("Admin can remove mint amount with multisig", async () => {
      console.log("Testing removing mint amount with multisig...");

      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      const message = buildMessageHash(
        "REMOVE_MINT_AMOUNT",
        pdas.canMint,
        mintAuthorityUser.publicKey,
        multisigAccount.nonce.toNumber()
      );

      const ed25519Ix1 = createEd25519Ix(owner1, message);
      const ed25519Ix2 = createEd25519Ix(owner2, message);

      const tx = await program.methods
        .removeMintAmount(mintAuthorityUser.publicKey)
        .accounts({
          multisig: multisigPda,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      console.log("Remove mint amount tx:", tx);

      // Fetch and verify the mint amount is now zero
      const fetchedAmount: anchor.BN = await program.methods
        .getMintAmount(mintAuthorityUser.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint
        })
        .view();
      console.log(fetchedAmount.toString());
      expect(fetchedAmount.toString()).to.be.equal("0", "Mint amount was not removed correctly");

      expect(fetchedAmount.toString()).to.equal("0");
    });

    it("Admin can remove a mint authority with multisig", async () => {
      console.log("Testing removing mint authority with multisig...");

      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      const message = buildMessageHash(
        "REMOVE_CAN_MINT",
        pdas.canMint,
        mintAuthorityUser.publicKey,
        multisigAccount.nonce.toNumber()
      );

      const ed25519Ix1 = createEd25519Ix(owner1, message);
      const ed25519Ix2 = createEd25519Ix(owner2, message);

      const tx = await program.methods
        .removeCanMint(mintAuthorityUser.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts,
          multisig: multisigPda,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      console.log("Removed mint authority tx:", tx);

      const afterCanMintAccount = await program.account.canMint.fetch(pdas.canMint);
      const authorityFoundAfter = afterCanMintAccount.authorities.some(auth =>
        auth.equals(mintAuthorityUser.publicKey)
      );
      assert.isFalse(authorityFoundAfter, "Mint authority was not removed");
    });

    it("Cannot add mint authority with insufficient signatures", async () => {
      console.log("Testing insufficient signatures...");

      const testUser = Keypair.generate();
      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      const message = buildMessageHash(
        "ADD_CAN_MINT",
        pdas.canMint,
        testUser.publicKey,
        multisigAccount.nonce.toNumber()
      );

      // Only one signature (threshold is 2)
      const ed25519Ix1 = createEd25519Ix(owner1, message);

      try {
        await program.methods
          .addCanMint(testUser.publicKey)
          .accounts({
            mint: mint.publicKey,
            tokenConfig: pdas.tokenConfig,
            blacklist: pdas.blacklist,
            canMint: pdas.canMint,
            trustedContracts: pdas.trustedContracts,
            multisig: multisigPda,
            instructions: SYSVAR_INSTRUCTIONS_PUBKEY
          })
          .preInstructions([ed25519Ix1])
          .rpc();

        assert.fail("Should have failed with insufficient signatures");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "NotEnoughMultisigSigners");
      }
    });
  });


  describe("Trusted Contract Admin Tests", () => {
    it("Admin can add trusted contract with multisig", async () => {
      console.log("Testing adding trusted contract with multisig...");

      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      const message = buildMessageHash(
        "ADD_TRUSTED_CONTRACT",
        pdas.trustedContracts,
        testContract.publicKey,
        multisigAccount.nonce.toNumber()
      );

      const ed25519Ix1 = createEd25519Ix(owner1, message);
      const ed25519Ix2 = createEd25519Ix(owner2, message);

      const tx = await program.methods
        .addTrustedContract(testContract.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          trustedContracts: pdas.trustedContracts,
          multisig: multisigPda,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      console.log("Add trusted contract tx:", tx);

      const trustedContractsAccount = await program.account.trustedContracts.fetch(pdas.trustedContracts);
      const contractFound = trustedContractsAccount.contracts.some(contract =>
        contract.equals(testContract.publicKey)
      );
      assert.isTrue(contractFound, "Contract was not added");
    });

    it("Admin can remove trusted contract with multisig", async () => {
      console.log("Testing removing trusted contract with multisig...");

      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      const message = buildMessageHash(
        "REMOVE_TRUSTED_CONTRACT",
        pdas.trustedContracts,
        testContract.publicKey,
        multisigAccount.nonce.toNumber()
      );

      const ed25519Ix1 = createEd25519Ix(owner1, message);
      const ed25519Ix2 = createEd25519Ix(owner2, message);

      const tx = await program.methods
        .removeTrustedContract(testContract.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          trustedContracts: pdas.trustedContracts,
          multisig: multisigPda,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      console.log("Remove trusted contract tx:", tx);

      const trustedContractsAccount = await program.account.trustedContracts.fetch(pdas.trustedContracts);
      const contractFoundAfter = trustedContractsAccount.contracts.some(contract =>
        contract.equals(testContract.publicKey)
      );
      assert.isFalse(contractFoundAfter, "Contract was not removed");
    });
  });


  describe("Can Forward Admin Tests", () => {
    it("Admin can add forwarder with multisig", async () => {
      console.log("Testing adding forwarder with multisig...");

      const forwarderToAdd = Keypair.generate();
      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      const message = buildMessageHash(
        "ADD_CAN_FORWARD",
        pdas.canForward,
        forwarderToAdd.publicKey,
        multisigAccount.nonce.toNumber()
      );

      const ed25519Ix1 = createEd25519Ix(owner1, message);
      const ed25519Ix2 = createEd25519Ix(owner2, message);

      const tx = await program.methods
        .addCanForward(forwarderToAdd.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canForward: pdas.canForward,
          multisig: multisigPda,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      console.log("Add forwarder tx:", tx);

      const canForwardAccount = await program.account.canForward.fetch(pdas.canForward);
      const forwarderFound = canForwardAccount.forwarders.some(forwarder =>
        forwarder.equals(forwarderToAdd.publicKey)
      );
      assert.isTrue(forwarderFound, "Forwarder was not added");
    });

    it("Admin can remove forwarder with multisig", async () => {
      console.log("Testing removing forwarder with multisig...");

      const forwarderToRemove = Keypair.generate();

      // First add the forwarder
      let multisigAccount = await program.account.multisig.fetch(multisigPda);
      let message = buildMessageHash(
        "ADD_CAN_FORWARD",
        pdas.canForward,
        forwarderToRemove.publicKey,
        multisigAccount.nonce.toNumber()
      );

      let ed25519Ix1 = createEd25519Ix(owner1, message);
      let ed25519Ix2 = createEd25519Ix(owner2, message);

      await program.methods
        .addCanForward(forwarderToRemove.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canForward: pdas.canForward,
          multisig: multisigPda,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      // Now remove the forwarder
      multisigAccount = await program.account.multisig.fetch(multisigPda);
      message = buildMessageHash(
        "REMOVE_CAN_FORWARD",
        pdas.canForward,
        forwarderToRemove.publicKey,
        multisigAccount.nonce.toNumber()
      );

      ed25519Ix1 = createEd25519Ix(owner1, message);
      ed25519Ix2 = createEd25519Ix(owner2, message);

      const tx = await program.methods
        .removeCanForward(forwarderToRemove.publicKey)
        .accounts({
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          canForward: pdas.canForward,
          multisig: multisigPda,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      console.log("Remove forwarder tx:", tx);

      const canForwardAccount = await program.account.canForward.fetch(pdas.canForward);
      const forwarderFoundAfter = canForwardAccount.forwarders.some(forwarder =>
        forwarder.equals(forwarderToRemove.publicKey)
      );
      assert.isFalse(forwarderFoundAfter, "Forwarder was not removed");
    });
  });

  describe("Multisig Update Tests", () => {
    it("Can update multisig owners and threshold", async () => {
      console.log("Testing updating multisig configuration...");

      const newOwner1 = Keypair.generate();
      const newOwner2 = Keypair.generate();
      const newThreshold = 2;

      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      // Use the specialized helper for multisig updates
      const message = buildMultisigUpdateMessage(
        multisigPda,
        [newOwner1.publicKey, newOwner2.publicKey],
        newThreshold,
        multisigAccount.nonce.toNumber()
      );

      const ed25519Ix1 = createEd25519Ix(owner1, message);
      const ed25519Ix2 = createEd25519Ix(owner2, message);

      const tx = await program.methods
        .updateMultisig(
          [newOwner1.publicKey, newOwner2.publicKey],
          newThreshold
        )
        .accounts({
          multisig: multisigPda,
          mint: mint.publicKey,
          tokenConfig: pdas.tokenConfig,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY
        })
        .preInstructions([ed25519Ix1, ed25519Ix2])
        .rpc();

      console.log("Update multisig tx:", tx);

      const updatedMultisig = await program.account.multisig.fetch(multisigPda);
      assert.equal(updatedMultisig.owners.length, 2, "Should have 2 owners");
      assert.equal(updatedMultisig.threshold, newThreshold, "Threshold should be updated");
      assert.isTrue(
        updatedMultisig.owners.some(o => o.equals(newOwner1.publicKey)),
        "New owner 1 should be in owners"
      );
      assert.isTrue(
        updatedMultisig.owners.some(o => o.equals(newOwner2.publicKey)),
        "New owner 2 should be in owners"
      );
    });
  });

  describe("Security Tests - Signature Forgery & Replay Attacks", () => {
    let attackerKeypair: Keypair;
    let victimUser: Keypair;

    before(async () => {
      attackerKeypair = Keypair.generate();
      victimUser = Keypair.generate();

      await provider.connection.requestAirdrop(
        attackerKeypair.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.requestAirdrop(
        victimUser.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );

      await new Promise(resolve => setTimeout(resolve, 2000));
    });



    it("Cannot use forged signature from non-owner", async () => {
      console.log("Testing forged signature attack...");

      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      // Attacker creates message
      const message = buildMessageHash(
        "ADD_CAN_MINT",
        pdas.canMint,
        attackerKeypair.publicKey,
        multisigAccount.nonce.toNumber()
      );

      // Attacker signs with their own key (not an owner)
      const forgedEd25519Ix1 = createEd25519Ix(attackerKeypair, message);
      const forgedEd25519Ix2 = createEd25519Ix(attackerKeypair, message);

      try {
        await program.methods
          .addCanMint(attackerKeypair.publicKey)
          .accounts({
            mint: mint.publicKey,
            tokenConfig: pdas.tokenConfig,
            blacklist: pdas.blacklist,
            canMint: pdas.canMint,
            trustedContracts: pdas.trustedContracts,
            multisig: multisigPda,
            instructions: SYSVAR_INSTRUCTIONS_PUBKEY
          })
          .preInstructions([forgedEd25519Ix1, forgedEd25519Ix2])
          .rpc();

        assert.fail("Should have failed with forged signatures");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "NotEnoughMultisigSigners");
      }

      // Verify attacker was NOT added
      const canMintAccount = await program.account.canMint.fetch(pdas.canMint);
      const attackerFound = canMintAccount.authorities.some(auth =>
        auth.equals(attackerKeypair.publicKey)
      );
      assert.isFalse(attackerFound, "Attacker should not be added to can_mint");
    });

    it("Cannot replay the same signed transaction", async () => {
      console.log("Testing replay attack prevention...");

      const testUser = Keypair.generate();
      let multisigAccount = await program.account.multisig.fetch(multisigPda);
      const originalNonce = multisigAccount.nonce.toNumber();

      // Create valid signatures for first transaction
      const message = buildMessageHash(
        "ADD_CAN_MINT",
        pdas.canMint,
        testUser.publicKey,
        originalNonce
      );

      const ed25519Ix1 = createEd25519Ix(owner1, message);
      const ed25519Ix2 = createEd25519Ix(owner2, message);

      // First transaction succeeds
      await program.methods
        .addCanMint(testUser.publicKey)
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

      console.log("First transaction succeeded");

      // Wait for state to settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify nonce was incremented
      multisigAccount = await program.account.multisig.fetch(multisigPda);
      console.log("Original nonce:", originalNonce, "New nonce:", multisigAccount.nonce.toNumber());
      assert.equal(
        multisigAccount.nonce.toNumber(),
        originalNonce + 1,
        "Nonce should be incremented"
      );

      // Try to replay the SAME signatures (with old nonce)
      try {
        await program.methods
          .addCanMint(testUser.publicKey)
          .accounts({
            mint: mint.publicKey,
            tokenConfig: pdas.tokenConfig,
            blacklist: pdas.blacklist,
            canMint: pdas.canMint,
            trustedContracts: pdas.trustedContracts,
            multisig: multisigPda,
            instructions: SYSVAR_INSTRUCTIONS_PUBKEY
          })
          .preInstructions([ed25519Ix1, ed25519Ix2]) // Same signatures!
          .rpc();

        assert.fail("Replay attack should have failed");
      } catch (error) {
        console.log("Caught expected replay error:", error.toString());
        // The error should contain "NotEnoughMultisigSigners" because
        // the signature verification fails when nonce doesn't match
        assert.include(
          error.toString(),
          "NotEnoughMultisigSigners",
          "Should fail with NotEnoughMultisigSigners error"
        );
      }
    });

    it("Cannot use valid signature for different operation", async () => {
      console.log("Testing signature reuse across operations...");

      const targetUser = Keypair.generate();
      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      // Create signatures for ADD_CAN_MINT
      const addMessage = buildMessageHash(
        "ADD_CAN_MINT",
        pdas.canMint,
        targetUser.publicKey,
        multisigAccount.nonce.toNumber()
      );

      const ed25519Ix1 = createEd25519Ix(owner1, addMessage);
      const ed25519Ix2 = createEd25519Ix(owner2, addMessage);

      // Try to use ADD_CAN_MINT signatures for REMOVE_CAN_MINT
      try {
        await program.methods
          .removeCanMint(targetUser.publicKey)
          .accounts({
            mint: mint.publicKey,
            tokenConfig: pdas.tokenConfig,
            canMint: pdas.canMint,
            trustedContracts: pdas.trustedContracts,
            multisig: multisigPda,
            instructions: SYSVAR_INSTRUCTIONS_PUBKEY
          })
          .preInstructions([ed25519Ix1, ed25519Ix2]) // Wrong operation!
          .rpc();

        assert.fail("Should have failed with wrong operation signatures");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "NotEnoughMultisigSigners");
      }
    });

    it("Cannot use valid signature for different account", async () => {
      console.log("Testing signature reuse for different account...");

      const legitimateUser = Keypair.generate();
      const maliciousUser = Keypair.generate();
      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      // Create signatures for legitimateUser
      const message = buildMessageHash(
        "ADD_CAN_MINT",
        pdas.canMint,
        legitimateUser.publicKey,
        multisigAccount.nonce.toNumber()
      );

      const ed25519Ix1 = createEd25519Ix(owner1, message);
      const ed25519Ix2 = createEd25519Ix(owner2, message);

      // Try to use signatures for maliciousUser instead
      try {
        await program.methods
          .addCanMint(maliciousUser.publicKey) // Different user!
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

        assert.fail("Should have failed with wrong user in instruction");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "NotEnoughMultisigSigners");
      }

      // Verify malicious user was NOT added
      const canMintAccount = await program.account.canMint.fetch(pdas.canMint);
      const maliciousFound = canMintAccount.authorities.some(auth =>
        auth.equals(maliciousUser.publicKey)
      );
      assert.isFalse(maliciousFound, "Malicious user should not be added");
    });

    it("Cannot execute with only one signature when threshold is 2", async () => {
      console.log("Testing insufficient signatures...");

      const testUser = Keypair.generate();
      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      const message = buildMessageHash(
        "ADD_CAN_MINT",
        pdas.canMint,
        testUser.publicKey,
        multisigAccount.nonce.toNumber()
      );

      // Only one signature
      const ed25519Ix1 = createEd25519Ix(owner1, message);

      try {
        await program.methods
          .addCanMint(testUser.publicKey)
          .accounts({
            mint: mint.publicKey,
            tokenConfig: pdas.tokenConfig,
            blacklist: pdas.blacklist,
            canMint: pdas.canMint,
            trustedContracts: pdas.trustedContracts,
            multisig: multisigPda,
            instructions: SYSVAR_INSTRUCTIONS_PUBKEY
          })
          .preInstructions([ed25519Ix1]) // Only 1 signature!
          .rpc();

        assert.fail("Should have failed with insufficient signatures");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "NotEnoughMultisigSigners");
      }
    });

    it("Cannot use duplicate signatures from same owner", async () => {
      console.log("Testing duplicate signature detection...");

      const testUser = Keypair.generate();
      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      const message = buildMessageHash(
        "ADD_CAN_MINT",
        pdas.canMint,
        testUser.publicKey,
        multisigAccount.nonce.toNumber()
      );

      // Two signatures from the SAME owner
      const ed25519Ix1 = createEd25519Ix(owner1, message);
      const ed25519Ix2 = createEd25519Ix(owner1, message); // Duplicate!

      try {
        await program.methods
          .addCanMint(testUser.publicKey)
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

        assert.fail("Should have failed with duplicate signatures");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        // Should fail because duplicates are filtered out by BTreeSet
        assert.include(error.toString(), "NotEnoughMultisigSigners");
      }
    });

    it("Cannot use signatures with wrong message format", async () => {
      console.log("Testing malformed message attack...");

      const testUser = Keypair.generate();
      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      // Create message with WRONG prefix
      const wrongMessage = buildMessageHash(
        "WRONG_PREFIX", // Wrong!
        pdas.canMint,
        testUser.publicKey,
        multisigAccount.nonce.toNumber()
      );

      const ed25519Ix1 = createEd25519Ix(owner1, wrongMessage);
      const ed25519Ix2 = createEd25519Ix(owner2, wrongMessage);

      try {
        await program.methods
          .addCanMint(testUser.publicKey)
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

        assert.fail("Should have failed with wrong message format");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "NotEnoughMultisigSigners");
      }
    });

    it("Cannot bypass multisig by calling without signatures", async () => {
      console.log("Testing direct call without signatures...");

      const testUser = Keypair.generate();

      try {
        await program.methods
          .addCanMint(testUser.publicKey)
          .accounts({
            mint: mint.publicKey,
            tokenConfig: pdas.tokenConfig,
            blacklist: pdas.blacklist,
            canMint: pdas.canMint,
            trustedContracts: pdas.trustedContracts,
            multisig: multisigPda,
            instructions: SYSVAR_INSTRUCTIONS_PUBKEY
          })
          // No preInstructions at all!
          .rpc();

        assert.fail("Should have failed without any signatures");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "NotEnoughMultisigSigners");
      }
    });

    it("Cannot execute with signatures from non-owners even if threshold met", async () => {
      console.log("Testing all non-owner signatures...");

      const nonOwner1 = Keypair.generate();
      const nonOwner2 = Keypair.generate();
      const testUser = Keypair.generate();
      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      const message = buildMessageHash(
        "ADD_CAN_MINT",
        pdas.canMint,
        testUser.publicKey,
        multisigAccount.nonce.toNumber()
      );

      // Signatures from non-owners
      const ed25519Ix1 = createEd25519Ix(nonOwner1, message);
      const ed25519Ix2 = createEd25519Ix(nonOwner2, message);

      try {
        await program.methods
          .addCanMint(testUser.publicKey)
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

        assert.fail("Should have failed with non-owner signatures");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "NotEnoughMultisigSigners");
      }
    });

    it("Cannot mix one valid owner signature with one non-owner signature", async () => {
      console.log("Testing mixed valid/invalid signatures...");

      const nonOwner = Keypair.generate();
      const testUser = Keypair.generate();
      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      const message = buildMessageHash(
        "ADD_CAN_MINT",
        pdas.canMint,
        testUser.publicKey,
        multisigAccount.nonce.toNumber()
      );

      // One valid, one invalid
      const ed25519Ix1 = createEd25519Ix(owner1, message);
      const ed25519Ix2 = createEd25519Ix(nonOwner, message); // Not an owner!

      try {
        await program.methods
          .addCanMint(testUser.publicKey)
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

        assert.fail("Should have failed with mixed signatures");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        // Only 1 valid signature, threshold is 2
        assert.include(error.toString(), "NotEnoughMultisigSigners");
      }
    });
  });

  describe("Cross-Operation Security Tests", () => {
    it("Cannot reuse signatures across different PDA accounts", async () => {
      console.log("Testing signature reuse across PDAs...");

      const testUser = Keypair.generate();
      const multisigAccount = await program.account.multisig.fetch(multisigPda);

      // Create signatures for can_mint PDA
      const canMintMessage = buildMessageHash(
        "ADD_CAN_MINT",
        pdas.canMint, // Signed for this PDA
        testUser.publicKey,
        multisigAccount.nonce.toNumber()
      );

      const ed25519Ix1 = createEd25519Ix(owner1, canMintMessage);
      const ed25519Ix2 = createEd25519Ix(owner2, canMintMessage);

      // Try to use for can_forward operation (different PDA)
      try {
        await program.methods
          .addCanForward(testUser.publicKey)
          .accounts({
            mint: mint.publicKey,
            tokenConfig: pdas.tokenConfig,
            blacklist: pdas.blacklist,
            canForward: pdas.canForward, // Different PDA!
            multisig: multisigPda,
            instructions: SYSVAR_INSTRUCTIONS_PUBKEY
          })
          .preInstructions([ed25519Ix1, ed25519Ix2])
          .rpc();

        assert.fail("Should have failed using wrong PDA in signature");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "NotEnoughMultisigSigners");
      }
    });
  });
});