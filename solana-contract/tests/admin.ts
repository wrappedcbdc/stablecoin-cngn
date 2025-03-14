import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Cngn } from "../target/types/cngn";
import { assert } from 'chai';
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

import { calculatePDAs, createTokenAccountIfNeeded } from './helpers';

describe("cngn admin functionality tests", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cngn as Program<Cngn>;

  // Create the mint keypair - this will be the actual token
  const mint = Keypair.generate();

  // Create keypairs for different test scenarios
  const otherAdmin = Keypair.generate();
  const testContract = Keypair.generate();
  const regularUser1 = Keypair.generate();
  const regularUser2 = Keypair.generate();
  const blacklistedUser = Keypair.generate();
  const mintAuthorityUser = Keypair.generate();

  // PDAs and token config 
  let pdas;

  // Token parameters
  const TOKEN_PARAMS = {
    name: "cNGN",
    symbol: "cNGN",
    decimals: 9,
    mintAmount: new anchor.BN(1000000000) // 1 token with 9 decimals
  };

  before(async () => {
    // Calculate all PDAs for the token
    pdas = calculatePDAs(mint.publicKey, program.programId);

    // Fund test accounts for gas
    const fundAccounts = [
      otherAdmin.publicKey,
      regularUser1.publicKey,
      regularUser2.publicKey,
      blacklistedUser.publicKey,
      mintAuthorityUser.publicKey,
      testContract.publicKey
    ];

    for (const account of fundAccounts) {
      await provider.connection.requestAirdrop(account, 1 * anchor.web3.LAMPORTS_PER_SOL);
    }

    // Initialize the token
    console.log("Initializing token and accounts...");
    try {
      const tx = await program.methods
        .initialize(TOKEN_PARAMS.name, TOKEN_PARAMS.symbol, TOKEN_PARAMS.decimals)
        .accounts({
          initializer: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          mintAuthority: pdas.mintAuthority,
          mint: mint.publicKey,
          canMint: pdas.canMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([mint])
        .rpc();
      console.log("Token initialized with tx:", tx);

      // Initialize blacklist and forwarding accounts
      await program.methods
        .initializeSecondary()
        .accounts({
          initializer: provider.wallet.publicKey,
          mint: mint.publicKey,
          blacklist: pdas.blacklist,
          canForward: pdas.canForward,
          trustedContracts: pdas.trustedContracts,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Initialize whitelist accounts
      await program.methods
        .initializeThird()
        .accounts({
          initializer: provider.wallet.publicKey,
          mint: mint.publicKey,
          internalWhitelist: pdas.internalWhitelist,
          externalWhitelist: pdas.externalWhitelist,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("All accounts initialized successfully");
    } catch (error) {
      console.error("Error during initialization:", error);
      throw error;
    }
  });

  describe("CanMint Admin Tests", () => {
    it("Admin can add a mint authority", async () => {
      console.log("Testing adding mint authority...");

      // Add mint authority to can_mint list
      const tx = await program.methods
        .addCanMint(mintAuthorityUser.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      console.log("Added mint authority tx:", tx);

      // Verify the mint authority was added
      const canMintAccount = await program.account.canMint.fetch(pdas.canMint);
      const authorityFound = canMintAccount.authorities.some(auth =>
        auth.equals(mintAuthorityUser.publicKey)
      );

      assert.isTrue(authorityFound, "Mint authority was not added to the can_mint list");
    });

    it("Admin can set mint amount for authority", async () => {
      console.log("Testing setting mint amount...");

      // Update mint amount for the authority
      const tx = await program.methods
        .updateMintAmount(mintAuthorityUser.publicKey, TOKEN_PARAMS.mintAmount)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      console.log("Set mint amount tx:", tx);

      // Fetch and verify the mint amount
      const fetchedAmount = await program.methods
        .getMintAmount(mintAuthorityUser.publicKey)
        .accounts({
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint
        })
        .view();

      assert.equal(
        fetchedAmount.toString(),
        TOKEN_PARAMS.mintAmount.toString(),
        "Mint amount was not set correctly"
      );
    });

    it("Admin can remove mint amount", async () => {
      console.log("Testing removing mint amount...");

      // Set mint amount to zero (effectively removing it)
      const tx = await program.methods
        .updateMintAmount(mintAuthorityUser.publicKey, new anchor.BN(0))
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      console.log("Remove mint amount tx:", tx);

      // Fetch and verify the mint amount is now zero
      const fetchedAmount = await program.methods
        .getMintAmount(mintAuthorityUser.publicKey)
        .accounts({
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint
        })
        .view();

      assert.equal(
        fetchedAmount.toString(),
        "0",
        "Mint amount was not removed correctly"
      );
    });

    it("Admin can remove a mint authority", async () => {
      console.log("Testing removing mint authority...");

      // First, make sure the authority is in the can_mint list
      const beforeCanMintAccount = await program.account.canMint.fetch(pdas.canMint);
      const authorityFoundBefore = beforeCanMintAccount.authorities.some(auth =>
        auth.equals(mintAuthorityUser.publicKey)
      );

      assert.isTrue(authorityFoundBefore, "Mint authority not found in can_mint list before removal");

      // Remove mint authority from can_mint list
      const tx = await program.methods
        .removeCanMint(mintAuthorityUser.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      console.log("Removed mint authority tx:", tx);

      // Verify the mint authority was removed
      const afterCanMintAccount = await program.account.canMint.fetch(pdas.canMint);
      const authorityFoundAfter = afterCanMintAccount.authorities.some(auth =>
        auth.equals(mintAuthorityUser.publicKey)
      );

      assert.isFalse(authorityFoundAfter, "Mint authority was not removed from the can_mint list");
    });

    it("Cannot add mint authority that is blacklisted", async () => {
      console.log("Testing adding blacklisted user to mint authorities...");

      // First, add user to blacklist
      await program.methods
        .addBlacklist(blacklistedUser.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist
        })
        .rpc();

      // Verify user is in blacklist
      const blacklistAccount = await program.account.blackList.fetch(pdas.blacklist);
      const userInBlacklist = blacklistAccount.blacklist.some(user =>
        user.equals(blacklistedUser.publicKey)
      );

      assert.isTrue(userInBlacklist, "User was not added to blacklist");

      // Try to add blacklisted user to can_mint list - this should fail
      try {
        await program.methods
          .addCanMint(blacklistedUser.publicKey)
          .accounts({
            authority: provider.wallet.publicKey,
            tokenConfig: pdas.tokenConfig,
            blacklist: pdas.blacklist,
            canMint: pdas.canMint,
            trustedContracts: pdas.trustedContracts
          })
          .rpc();

        assert.fail("Should have failed when adding blacklisted user to mint authorities");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "UserBlacklisted");
      }

      // Verify the blacklisted user was not added to can_mint
      const canMintAccount = await program.account.canMint.fetch(pdas.canMint);
      const userInCanMint = canMintAccount.authorities.some(auth =>
        auth.equals(blacklistedUser.publicKey)
      );

      assert.isFalse(userInCanMint, "Blacklisted user was incorrectly added to the can_mint list");
    });

    it("Non-admin cannot add mint authorities", async () => {
      console.log("Testing non-admin adding mint authority...");

      try {
        // Regular user tries to add a mint authority
        await program.methods
          .addCanMint(regularUser2.publicKey)
          .accounts({
            authority: regularUser1.publicKey,
            tokenConfig: pdas.tokenConfig,
            blacklist: pdas.blacklist,
            canMint: pdas.canMint,
            trustedContracts: pdas.trustedContracts
          })
          .signers([regularUser1])
          .rpc();

        assert.fail("Should have failed with unauthorized error");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "Unauthorized");
      }
    });
  });


  describe("Trusted Contract Admin Tests", () => {
    it("Admin can add trusted contract", async () => {
      console.log("Testing adding trusted contract...");

      const tx = await program.methods
        .addTrustedContract(testContract.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      console.log("Add trusted contract tx:", tx);

      // Verify the contract was added
      const trustedContractsAccount = await program.account.trustedContracts.fetch(pdas.trustedContracts);
      const contractFound = trustedContractsAccount.contracts.some(contract =>
        contract.equals(testContract.publicKey)
      );

      assert.isTrue(contractFound, "Contract was not added to trusted contracts");
    });

    it("Trusted contract can add mint authority", async () => {
      console.log("Testing trusted contract adding mint authority...");

      // First verify test contract is in trusted contracts
      const trustedContractsAccount = await program.account.trustedContracts.fetch(pdas.trustedContracts);
      const contractFound = trustedContractsAccount.contracts.some(contract =>
        contract.equals(testContract.publicKey)
      );

      assert.isTrue(contractFound, "Test contract not found in trusted contracts list");

      // Have the trusted contract add a mint authority
      const tx = await program.methods
        .addCanMint(otherAdmin.publicKey)
        .accounts({
          authority: testContract.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .signers([testContract])
        .rpc();

      console.log("Added mint authority by trusted contract tx:", tx);

      // Verify the mint authority was added
      const canMintAccount = await program.account.canMint.fetch(pdas.canMint);
      const authorityFound = canMintAccount.authorities.some(auth =>
        auth.equals(otherAdmin.publicKey)
      );

      assert.isTrue(authorityFound, "Mint authority was not added by trusted contract");
    });

    it("Admin can remove trusted contract", async () => {
      console.log("Testing removing trusted contract...");

      // Add a contract specifically for removal test
      const contractToRemove = Keypair.generate();

      await program.methods
        .addTrustedContract(contractToRemove.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      // Verify it was added
      let trustedContractsAccount = await program.account.trustedContracts.fetch(pdas.trustedContracts);
      const contractFound = trustedContractsAccount.contracts.some(contract =>
        contract.equals(contractToRemove.publicKey)
      );

      assert.isTrue(contractFound, "Contract was not added to trusted contracts before removal test");

      // Now remove the contract
      const tx = await program.methods
        .removeTrustedContract(contractToRemove.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      console.log("Remove trusted contract tx:", tx);

      // Verify the contract was removed
      trustedContractsAccount = await program.account.trustedContracts.fetch(pdas.trustedContracts);
      const contractFoundAfter = trustedContractsAccount.contracts.some(contract =>
        contract.equals(contractToRemove.publicKey)
      );

      assert.isFalse(contractFoundAfter, "Contract was not removed from trusted contracts");
    });
    // Add to the existing "Trusted Contract Admin Tests" describe block
    it("Non-admin cannot add trusted contracts", async () => {
      console.log("Testing non-admin adding trusted contract...");

      try {
        // Regular user tries to add trusted contract
        await program.methods
          .addTrustedContract(regularUser2.publicKey)
          .accounts({
            authority: regularUser1.publicKey,
            tokenConfig: pdas.tokenConfig,
            trustedContracts: pdas.trustedContracts
          })
          .signers([regularUser1])
          .rpc();

        assert.fail("Should have failed with unauthorized error");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "Unauthorized");
      }
    });
  });
  // Add new test blocks for blacklist & whitelist functionality
  describe("Blacklist Admin Tests", () => {
    it("Admin can add account to blacklist", async () => {
      console.log("Testing adding account to blacklist...");

      const accountToBlacklist = Keypair.generate();

      const tx = await program.methods
        .addBlacklist(accountToBlacklist.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist
        })
        .rpc();

      console.log("Add to blacklist tx:", tx);

      // Verify the account was added to blacklist
      const blacklistAccount = await program.account.blackList.fetch(pdas.blacklist);
      const accountFound = blacklistAccount.blacklist.some(account =>
        account.equals(accountToBlacklist.publicKey)
      );

      assert.isTrue(accountFound, "Account was not added to blacklist");
    });

    it("Admin can remove account from blacklist", async () => {
      console.log("Testing removing account from blacklist...");

      // First, add an account to blacklist if not already present
      const accountToUnblacklist = Keypair.generate();

      await program.methods
        .addBlacklist(accountToUnblacklist.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist
        })
        .rpc();

      // Verify the account was added to blacklist
      let blacklistAccount = await program.account.blackList.fetch(pdas.blacklist);
      const accountFound = blacklistAccount.blacklist.some(account =>
        account.equals(accountToUnblacklist.publicKey)
      );

      assert.isTrue(accountFound, "Account was not added to blacklist before removal test");

      // Now remove the account from blacklist
      const tx = await program.methods
        .removeBlacklist(accountToUnblacklist.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist
        })
        .rpc();

      console.log("Remove from blacklist tx:", tx);

      // Verify the account was removed from blacklist
      blacklistAccount = await program.account.blackList.fetch(pdas.blacklist);
      const accountFoundAfter = blacklistAccount.blacklist.some(account =>
        account.equals(accountToUnblacklist.publicKey)
      );

      assert.isFalse(accountFoundAfter, "Account was not removed from blacklist");
    });

    it("Non-admin cannot add/remove from blacklist", async () => {
      console.log("Testing non-admin managing blacklist...");

      try {
        const accountToBlacklist = Keypair.generate();

        await program.methods
          .addBlacklist(accountToBlacklist.publicKey)
          .accounts({
            authority: regularUser1.publicKey,
            tokenConfig: pdas.tokenConfig,
            blacklist: pdas.blacklist
          })
          .signers([regularUser1])
          .rpc();

        assert.fail("Should have failed with unauthorized error");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "Unauthorized");
      }
    });
  });

  describe("Internal Whitelist Admin Tests", () => {
    it("Admin can add user to internal whitelist", async () => {
      console.log("Testing adding user to internal whitelist...");

      const userToWhitelist = Keypair.generate();

      const tx = await program.methods
        .whitelistInternalUser(userToWhitelist.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          internalWhitelist: pdas.internalWhitelist,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      console.log("Add to internal whitelist tx:", tx);

      // Verify the user was added to internal whitelist
      const internalWhitelistAccount = await program.account.internalWhiteList.fetch(pdas.internalWhitelist);
      const userFound = internalWhitelistAccount.whitelist.some(user =>
        user.equals(userToWhitelist.publicKey)
      );

      assert.isTrue(userFound, "User was not added to internal whitelist");
    });

    it("Admin can remove user from internal whitelist", async () => {
      console.log("Testing removing user from internal whitelist...");

      // First, add a user to internal whitelist if not already present
      const userToBlacklist = Keypair.generate();

      await program.methods
        .whitelistInternalUser(userToBlacklist.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          internalWhitelist: pdas.internalWhitelist,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      // Verify the user was added to internal whitelist
      let internalWhitelistAccount = await program.account.internalWhiteList.fetch(pdas.internalWhitelist);
      const userFound = internalWhitelistAccount.whitelist.some(user =>
        user.equals(userToBlacklist.publicKey)
      );

      assert.isTrue(userFound, "User was not added to internal whitelist before removal test");

      // Now remove the user from internal whitelist
      const tx = await program.methods
        .blacklistInternalUser(userToBlacklist.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          internalWhitelist: pdas.internalWhitelist,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      console.log("Remove from internal whitelist tx:", tx);

      // Verify the user was removed from internal whitelist
      internalWhitelistAccount = await program.account.internalWhiteList.fetch(pdas.internalWhitelist);
      const userFoundAfter = internalWhitelistAccount.whitelist.some(user =>
        user.equals(userToBlacklist.publicKey)
      );

      assert.isFalse(userFoundAfter, "User was not removed from internal whitelist");
    });

  

    it("Non-admin cannot manage internal whitelist", async () => {
      console.log("Testing non-admin managing internal whitelist...");

      try {
        const userToWhitelist = Keypair.generate();

        await program.methods
          .whitelistInternalUser(userToWhitelist.publicKey)
          .accounts({
            authority: regularUser1.publicKey,
            tokenConfig: pdas.tokenConfig,
            internalWhitelist: pdas.internalWhitelist,
            trustedContracts: pdas.trustedContracts
          })
          .signers([regularUser1])
          .rpc();

        assert.fail("Should have failed with unauthorized error");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "Unauthorized");
      }
    });
  });

  describe("External Whitelist Admin Tests", () => {
    it("Admin can add user to external whitelist", async () => {
      console.log("Testing adding user to external whitelist...");
  
      const userToWhitelist = Keypair.generate();
  
      const tx = await program.methods
        .whitelistExternalUser(userToWhitelist.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          externalWhitelist: pdas.externalWhitelist,
          blacklist: pdas.blacklist
        })
        .rpc();
  
      console.log("Add to external whitelist tx:", tx);
  
      // Verify the user was added to external whitelist
      const externalWhitelistAccount = await program.account.externalWhiteList.fetch(pdas.externalWhitelist);
      const userFound = externalWhitelistAccount.whitelist.some(user =>
        user.equals(userToWhitelist.publicKey)
      );
  
      assert.isTrue(userFound, "User was not added to external whitelist");
    });
  
    it("Admin can remove user from external whitelist", async () => {
      console.log("Testing removing user from external whitelist...");
  
      // First, add a user to external whitelist if not already present
      const userToRemove = Keypair.generate();
  
      await program.methods
        .whitelistExternalUser(userToRemove.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          externalWhitelist: pdas.externalWhitelist,
          blacklist: pdas.blacklist
        })
        .rpc();
  
      // Verify the user was added to external whitelist
      let externalWhitelistAccount = await program.account.externalWhiteList.fetch(pdas.externalWhitelist);
      const userFound = externalWhitelistAccount.whitelist.some(user =>
        user.equals(userToRemove.publicKey)
      );
  
      assert.isTrue(userFound, "User was not added to external whitelist before removal test");
  
      // Now remove the user from external whitelist
      const tx = await program.methods
        .blacklistExternalUser(userToRemove.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          externalWhitelist: pdas.externalWhitelist
        })
        .rpc();
  
      console.log("Remove from external whitelist tx:", tx);
  
      // Verify the user was removed from external whitelist
      externalWhitelistAccount = await program.account.externalWhiteList.fetch(pdas.externalWhitelist);
      const userFoundAfter = externalWhitelistAccount.whitelist.some(user =>
        user.equals(userToRemove.publicKey)
      );
  
      assert.isFalse(userFoundAfter, "User was not removed from external whitelist");
    });
  
    it("Cannot add blacklisted user to external whitelist", async () => {
      console.log("Testing adding blacklisted user to external whitelist...");
  
      // Create a user that will be blacklisted
      const blacklistedExternalUser = Keypair.generate();
  
      // Fund the account for gas
      await provider.connection.requestAirdrop(
        blacklistedExternalUser.publicKey, 
        0.1 * anchor.web3.LAMPORTS_PER_SOL
      );
  
      // First, add user to blacklist
      await program.methods
        .addBlacklist(blacklistedExternalUser.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist
        })
        .rpc();
  
      // Verify user is in blacklist
      const blacklistAccount = await program.account.blackList.fetch(pdas.blacklist);
      const userInBlacklist = blacklistAccount.blacklist.some(user =>
        user.equals(blacklistedExternalUser.publicKey)
      );
  
      assert.isTrue(userInBlacklist, "User was not added to blacklist");
  
      // Try to add blacklisted user to external whitelist - this should fail
      try {
        await program.methods
          .whitelistExternalUser(blacklistedExternalUser.publicKey)
          .accounts({
            authority: provider.wallet.publicKey,
            tokenConfig: pdas.tokenConfig,
            externalWhitelist: pdas.externalWhitelist,
            blacklist: pdas.blacklist
          })
          .rpc();
  
        assert.fail("Should have failed when adding blacklisted user to external whitelist");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "UserBlacklisted");
      }
  
      // Verify the blacklisted user was not added to external whitelist
      const externalWhitelistAccount = await program.account.externalWhiteList.fetch(pdas.externalWhitelist);
      const userInWhitelist = externalWhitelistAccount.whitelist.some(user =>
        user.equals(blacklistedExternalUser.publicKey)
      );
  
      assert.isFalse(userInWhitelist, "Blacklisted user was incorrectly added to the external whitelist");
    });
  
    it("Non-admin cannot manage external whitelist", async () => {
      console.log("Testing non-admin managing external whitelist...");
  
      try {
        const userToWhitelist = Keypair.generate();
  
        await program.methods
          .whitelistExternalUser(userToWhitelist.publicKey)
          .accounts({
            authority: regularUser1.publicKey,
            tokenConfig: pdas.tokenConfig,
            externalWhitelist: pdas.externalWhitelist,
            blacklist: pdas.blacklist
          })
          .signers([regularUser1])
          .rpc();
  
        assert.fail("Should have failed with unauthorized error");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "Unauthorized");
      }
    });
  });
  
  describe("Can Forward Admin Tests", () => {
    it("Admin can add forwarder", async () => {
      console.log("Testing adding forwarder...");
  
      const forwarderToAdd = Keypair.generate();
  
      const tx = await program.methods
        .addCanForward(forwarderToAdd.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canForward: pdas.canForward
        })
        .rpc();
  
      console.log("Add forwarder tx:", tx);
  
      // Verify the forwarder was added
      const canForwardAccount = await program.account.canForward.fetch(pdas.canForward);
      const forwarderFound = canForwardAccount.forwarders.some(forwarder =>
        forwarder.equals(forwarderToAdd.publicKey)
      );
  
      assert.isTrue(forwarderFound, "Forwarder was not added to can forward list");
    });
  
    it("Admin can remove forwarder", async () => {
      console.log("Testing removing forwarder...");
  
      // First, add a forwarder if not already present
      const forwarderToRemove = Keypair.generate();
  
      await program.methods
        .addCanForward(forwarderToRemove.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canForward: pdas.canForward
        })
        .rpc();
  
      // Verify the forwarder was added
      let canForwardAccount = await program.account.canForward.fetch(pdas.canForward);
      const forwarderFound = canForwardAccount.forwarders.some(forwarder =>
        forwarder.equals(forwarderToRemove.publicKey)
      );
  
      assert.isTrue(forwarderFound, "Forwarder was not added before removal test");
  
      // Now remove the forwarder
      const tx = await program.methods
        .removeCanForward(forwarderToRemove.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          canForward: pdas.canForward
        })
        .rpc();
  
      console.log("Remove forwarder tx:", tx);
  
      // Verify the forwarder was removed
      canForwardAccount = await program.account.canForward.fetch(pdas.canForward);
      const forwarderFoundAfter = canForwardAccount.forwarders.some(forwarder =>
        forwarder.equals(forwarderToRemove.publicKey)
      );
  
      assert.isFalse(forwarderFoundAfter, "Forwarder was not removed from can forward list");
    });
  
    it("Cannot add blacklisted user as forwarder", async () => {
      console.log("Testing adding blacklisted user as forwarder...");
  
      // Create a user that will be blacklisted
      const blacklistedForwarder = Keypair.generate();
  
      // Fund the account for gas
      await provider.connection.requestAirdrop(
        blacklistedForwarder.publicKey, 
        0.1 * anchor.web3.LAMPORTS_PER_SOL
      );
  
      // First, add user to blacklist
      await program.methods
        .addBlacklist(blacklistedForwarder.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist
        })
        .rpc();
  
      // Verify user is in blacklist
      const blacklistAccount = await program.account.blackList.fetch(pdas.blacklist);
      const userInBlacklist = blacklistAccount.blacklist.some(user =>
        user.equals(blacklistedForwarder.publicKey)
      );
  
      assert.isTrue(userInBlacklist, "User was not added to blacklist");
  
      // Try to add blacklisted user as forwarder - this should fail
      try {
        await program.methods
          .addCanForward(blacklistedForwarder.publicKey)
          .accounts({
            authority: provider.wallet.publicKey,
            tokenConfig: pdas.tokenConfig,
            blacklist: pdas.blacklist,
            canForward: pdas.canForward
          })
          .rpc();
  
        assert.fail("Should have failed when adding blacklisted user as forwarder");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "UserBlacklisted");
      }
  
      // Verify the blacklisted user was not added as forwarder
      const canForwardAccount = await program.account.canForward.fetch(pdas.canForward);
      const userInForwarders = canForwardAccount.forwarders.some(forwarder =>
        forwarder.equals(blacklistedForwarder.publicKey)
      );
  
      assert.isFalse(userInForwarders, "Blacklisted user was incorrectly added as forwarder");
    });
  
    it("Non-admin cannot manage forwarders", async () => {
      console.log("Testing non-admin managing forwarders...");
  
      try {
        const forwarderToAdd = Keypair.generate();
  
        await program.methods
          .addCanForward(forwarderToAdd.publicKey)
          .accounts({
            authority: regularUser1.publicKey,
            tokenConfig: pdas.tokenConfig,
            blacklist: pdas.blacklist,
            canForward: pdas.canForward
          })
          .signers([regularUser1])
          .rpc();
  
        assert.fail("Should have failed with unauthorized error");
      } catch (error) {
        console.log("Caught expected error:", error.toString());
        assert.include(error.toString(), "Unauthorized");
      }
    });
  });
});