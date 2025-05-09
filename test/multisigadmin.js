const assert = require("assert");
const { ethers } = require("hardhat");

describe("MultiSig with Admin", function () {
  let MultiSig;
  let multiSig;
  let Admin;
  let admin;
  let owner1, owner2, owner3, nonOwner;
  let requiredApprovals = 2;

  beforeEach(async function () {
    [owner1, owner2, owner3, nonOwner] = await ethers.getSigners();
    
    // Deploy the MultiSig contract
    MultiSig = await ethers.getContractFactory("MultiSig");
    multiSig = await MultiSig.deploy(
      [owner1.address, owner2.address, owner3.address],
      requiredApprovals
    );
    await multiSig.deployed();
    
    // Deploy the Admin contract
    Admin = await ethers.getContractFactory("Admin2");

    admin = await upgrades.deployProxy(Admin, [], { initializer: 'initialize' });
    
    // Transfer ownership of Admin to MultiSig
    await admin.transferOwnership(multiSig.address);
  });

  describe("Deployment", function () {
    it("Should set the correct owners in MultiSig", async function () {
      assert.equal(await multiSig.owners(0), owner1.address);
      assert.equal(await multiSig.owners(1), owner2.address);
      assert.equal(await multiSig.owners(2), owner3.address);
      
      assert.equal(await multiSig.isOwner(owner1.address), true);
      assert.equal(await multiSig.isOwner(owner2.address), true);
      assert.equal(await multiSig.isOwner(owner3.address), true);
      assert.equal(await multiSig.isOwner(nonOwner.address), false);
    });

    it("Should set the correct required approvals", async function () {
      assert.equal(await multiSig.required(), requiredApprovals);
    });

    it("Should transfer Admin ownership to MultiSig", async function () {
      assert.equal(await admin.owner(), multiSig.address);
    });
  });

  describe("External Sender Management", function () {
    it("Should whitelist an external sender through MultiSig", async function () {
      // Prepare transaction data to whitelist an external sender
      const data = admin.interface.encodeFunctionData("whitelistExternalSender", [nonOwner.address]);
      
      // Submit transaction through MultiSig
      await multiSig.submitTransaction(admin.address, 0, data);
      
      // First approval
      await multiSig.approveTransaction(0);
      
      // Second approval should execute the transaction
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Check if the external sender was whitelisted
      assert.equal(await admin.isExternalSenderWhitelisted(nonOwner.address), true);
    });

    it("Should blacklist an external sender through MultiSig", async function () {
      // First whitelist the sender
      let data = admin.interface.encodeFunctionData("whitelistExternalSender", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Now blacklist the sender
      data = admin.interface.encodeFunctionData("blacklistExternalSender", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      // Check if the sender was blacklisted
      assert.equal(await admin.isExternalSenderWhitelisted(nonOwner.address), false);
    });
  });

  describe("Internal User Management", function () {
    it("Should whitelist an internal user through MultiSig", async function () {
      const data = admin.interface.encodeFunctionData("whitelistInternalUser", [nonOwner.address]);
      
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      assert.equal(await admin.isInternalUserWhitelisted(nonOwner.address), true);
    });

    it("Should blacklist an internal user through MultiSig", async function () {
      // First whitelist the user
      let data = admin.interface.encodeFunctionData("whitelistInternalUser", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Now blacklist the user
      data = admin.interface.encodeFunctionData("blacklistInternalUser", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      assert.equal(await admin.isInternalUserWhitelisted(nonOwner.address), false);
    });
  });

  describe("Trusted Contract Management", function () {
    it("Should add a trusted contract through MultiSig", async function () {
      const data = admin.interface.encodeFunctionData("addTrustedContract", [nonOwner.address]);
      
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      assert.equal(await admin.trustedContract(nonOwner.address), true);
    });

    it("Should remove a trusted contract through MultiSig", async function () {
      // First add the trusted contract
      let data = admin.interface.encodeFunctionData("addTrustedContract", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Now remove it
      data = admin.interface.encodeFunctionData("removeTrustedContract", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      assert.equal(await admin.trustedContract(nonOwner.address), false);
    });
  });

  describe("Blacklist Management", function () {
    it("Should add a user to blacklist through MultiSig", async function () {
      const data = admin.interface.encodeFunctionData("addBlackList", [nonOwner.address]);
      
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      assert.equal(await admin.isBlackListed(nonOwner.address), true);
    });

    it("Should remove a user from blacklist through MultiSig", async function () {
      // First blacklist the user
      let data = admin.interface.encodeFunctionData("addBlackList", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Now remove from blacklist
      data = admin.interface.encodeFunctionData("removeBlackList", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      assert.equal(await admin.isBlackListed(nonOwner.address), false);
    });
  });

  describe("Minting Management", function () {
    it("Should add minting privileges through MultiSig", async function () {
      const data = admin.interface.encodeFunctionData("addCanMint", [nonOwner.address]);
      
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      assert.equal(await admin.canMint(nonOwner.address), true);
    });

    it("Should remove minting privileges through MultiSig", async function () {
      // First add minting privileges
      let data = admin.interface.encodeFunctionData("addCanMint", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Now remove them
      data = admin.interface.encodeFunctionData("removeCanMint", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      assert.equal(await admin.canMint(nonOwner.address), false);
    });

    it("Should set mint amount through MultiSig", async function () {
      // First add minting privileges
      let data = admin.interface.encodeFunctionData("addCanMint", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Now set the mint amount
      const mintAmount = ethers.utils.parseEther("100");
      data = admin.interface.encodeFunctionData("addMintAmount", [nonOwner.address, mintAmount]);
      
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      assert.equal(
        (await admin.mintAmount(nonOwner.address)).toString(),
        mintAmount.toString()
      );
    });

    it("Should remove mint amount through MultiSig", async function () {
      // First add minting privileges and set amount
      let data = admin.interface.encodeFunctionData("addCanMint", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      const mintAmount = ethers.utils.parseEther("100");
      data = admin.interface.encodeFunctionData("addMintAmount", [nonOwner.address, mintAmount]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      // Now remove the mint amount
      data = admin.interface.encodeFunctionData("removeMintAmount", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(2);
      await multiSig.connect(owner2).approveTransaction(2);
      
      assert.equal((await admin.mintAmount(nonOwner.address)).toString(), "0");
    });
  });

  describe("Forwarder Management", function () {
    it("Should add forwarder privileges through MultiSig", async function () {
      const data = admin.interface.encodeFunctionData("addCanForward", [nonOwner.address]);
      
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      assert.equal(await admin.canForward(nonOwner.address), true);
    });

    it("Should remove forwarder privileges through MultiSig", async function () {
      // First add forwarder privileges
      let data = admin.interface.encodeFunctionData("addCanForward", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Now remove them
      data = admin.interface.encodeFunctionData("removeCanForward", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      assert.equal(await admin.canForward(nonOwner.address), false);
    });
  });

  describe("Error Handling in Admin Operations", function () {
    it("Should handle failed operations properly", async function () {
      // Try to remove a non-existent trusted contract
      const data = admin.interface.encodeFunctionData("removeTrustedContract", [nonOwner.address]);
      
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      
      // Second approval will try to execute but should fail
      let error;
      try {
        await multiSig.connect(owner2).approveTransaction(0);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      
      // Transaction should not be marked as executed due to revert
      const tx = await multiSig.transactions(0);
      assert.equal(tx.executed, false);
    });

    it("Should not allow actions on blacklisted users", async function () {
      // First blacklist the user
      let data = admin.interface.encodeFunctionData("addBlackList", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Try to add minting privileges to blacklisted user (should fail)
      data = admin.interface.encodeFunctionData("addCanMint", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      
      let error;
      try {
        await multiSig.connect(owner2).approveTransaction(1);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      
      // Check that the user didn't get minting privileges
      assert.equal(await admin.canMint(nonOwner.address), false);
    });

    it("Should not allow whitelisting already whitelisted internal user", async function () {
      // First whitelist the user
      let data = admin.interface.encodeFunctionData("whitelistInternalUser", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Try to whitelist again (should fail)
      data = admin.interface.encodeFunctionData("whitelistInternalUser", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      
      let error;
      try {
        await multiSig.connect(owner2).approveTransaction(1);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
    });
  });

  describe("Complex Admin Operations", function () {
    it("Should handle multiple Admin operations in sequence", async function () {
      // 1. Add user as minter
      let data = admin.interface.encodeFunctionData("addCanMint", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // 2. Set mint amount
      const mintAmount = ethers.utils.parseEther("50");
      data = admin.interface.encodeFunctionData("addMintAmount", [nonOwner.address, mintAmount]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      // 3. Add as forwarder
      data = admin.interface.encodeFunctionData("addCanForward", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(2);
      await multiSig.connect(owner2).approveTransaction(2);
      
      // 4. Whitelist as internal user
      data = admin.interface.encodeFunctionData("whitelistInternalUser", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(3);
      await multiSig.connect(owner2).approveTransaction(3);
      
      // 5. Whitelist as external sender
      data = admin.interface.encodeFunctionData("whitelistExternalSender", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(4);
      await multiSig.connect(owner2).approveTransaction(4);
      
      // Verify all operations worked
      assert.equal(await admin.canMint(nonOwner.address), true);
      assert.equal((await admin.mintAmount(nonOwner.address)).toString(), mintAmount.toString());
      assert.equal(await admin.canForward(nonOwner.address), true);
      assert.equal(await admin.isInternalUserWhitelisted(nonOwner.address), true);
      assert.equal(await admin.isExternalSenderWhitelisted(nonOwner.address), true);
    });

    it("Should handle complete revocation of all privileges", async function () {
      // First set up all privileges
      // 1. Add user as minter and set amount
      let data = admin.interface.encodeFunctionData("addCanMint", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      data = admin.interface.encodeFunctionData("addMintAmount", [nonOwner.address, ethers.utils.parseEther("50")]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      // 2. Add as forwarder
      data = admin.interface.encodeFunctionData("addCanForward", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(2);
      await multiSig.connect(owner2).approveTransaction(2);
      
      // 3. Whitelist as internal and external user
      data = admin.interface.encodeFunctionData("whitelistInternalUser", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(3);
      await multiSig.connect(owner2).approveTransaction(3);
      
      data = admin.interface.encodeFunctionData("whitelistExternalSender", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(4);
      await multiSig.connect(owner2).approveTransaction(4);
      
      // Now revoke all privileges
      // 1. Remove mint amount
      data = admin.interface.encodeFunctionData("removeMintAmount", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(5);
      await multiSig.connect(owner2).approveTransaction(5);
      
      // 2. Remove minting privileges
      data = admin.interface.encodeFunctionData("removeCanMint", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(6);
      await multiSig.connect(owner2).approveTransaction(6);
      
      // 3. Remove forwarder privileges
      data = admin.interface.encodeFunctionData("removeCanForward", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(7);
      await multiSig.connect(owner2).approveTransaction(7);
      
      // 4. Blacklist as internal and external user
      data = admin.interface.encodeFunctionData("blacklistInternalUser", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(8);
      await multiSig.connect(owner2).approveTransaction(8);
      
      data = admin.interface.encodeFunctionData("blacklistExternalSender", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(9);
      await multiSig.connect(owner2).approveTransaction(9);
      
      // 5. Add to blacklist
      data = admin.interface.encodeFunctionData("addBlackList", [nonOwner.address]);
      await multiSig.submitTransaction(admin.address, 0, data);
      await multiSig.approveTransaction(10);
      await multiSig.connect(owner2).approveTransaction(10);
      
      // Verify all privileges revoked
      assert.equal(await admin.canMint(nonOwner.address), false);
      assert.equal((await admin.mintAmount(nonOwner.address)).toString(), "0");
      assert.equal(await admin.canForward(nonOwner.address), false);
      assert.equal(await admin.isInternalUserWhitelisted(nonOwner.address), false);
      assert.equal(await admin.isExternalSenderWhitelisted(nonOwner.address), false);
      assert.equal(await admin.isBlackListed(nonOwner.address), true);
    });
  });
});