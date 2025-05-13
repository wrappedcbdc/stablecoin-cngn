const assert = require("assert");
const { ethers } = require("hardhat");

describe("MultiSig", function () {
  let MultiSig;
  let multiSig;
  let owner1, owner2, owner3, nonOwner;
  let requiredApprovals = 2;
  let TestContract;
  let testContract;

  beforeEach(async function () {
    [owner1, owner2, owner3, nonOwner] = await ethers.getSigners();

    // Deploy the MultiSig contract
    MultiSig = await ethers.getContractFactory("MultiSig");
    multiSig = await MultiSig.deploy(
      [owner1.address, owner2.address, owner3.address],
      requiredApprovals
    );
    await multiSig.deployed();

    // Deploy a simple test contract that will be called by the MultiSig
    TestContract = await ethers.getContractFactory("TestContract");
    testContract = await TestContract.deploy();
    await testContract.deployed();
  });

describe("Deployment", function () {
    it("Should set the correct owners", async function () {
      const owners = await multiSig.getOwners();
      assert.equal(owners[0], owner1.address);
      assert.equal(owners[1], owner2.address);
      assert.equal(owners[2], owner3.address);

      assert.equal(await multiSig.isOwner(owner1.address), true);
      assert.equal(await multiSig.isOwner(owner2.address), true);
      assert.equal(await multiSig.isOwner(owner3.address), true);
      assert.equal(await multiSig.isOwner(nonOwner.address), false);
    });

    it("Should set the correct required approvals", async function () {
      assert.equal(await multiSig.required(), requiredApprovals);
    });

    it("Should fail if owners array is less than 2", async function () {
      let error;
      try {
        await MultiSig.deploy([owner1.address], 1);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("At least two owners are required"), "Expected error message not found");
    });

    it("Should fail if required approvals is greater than number of owners", async function () {
      let error;
      try {
        await MultiSig.deploy([owner1.address, owner2.address], 3);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Invalid required approvals"), "Expected error message not found");
    });

    it("Should fail if zero address is provided", async function () {
      let error;
      try {
        await MultiSig.deploy([owner1.address, ethers.constants.AddressZero], 1);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Invalid owner address"), "Expected error message not found");
    });

    it("Should fail if duplicate owners are provided", async function () {
      let error;
      try {
        await MultiSig.deploy([owner1.address, owner1.address], 1);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Duplicate owner"), "Expected error message not found");
    });
  });

  describe("Transaction Submission", function () {
    it("Should allow an owner to submit a transaction", async function () {
      const data = testContract.interface.encodeFunctionData("setValue", [42]);

      // Check for event emission
      const tx = await multiSig.submitTransaction(testContract.address, 0, data);

      const receipt = await tx.wait();

      // Check if TransactionCreated event was emitted
      const event = receipt.events.find(e => e.event === "TransactionCreated");
      assert.ok(event, "TransactionCreated event should be emitted");
      assert.equal(event.args[0], owner1.address);
      assert.equal(event.args[1].toNumber(), 0);

      // Get transaction count should return 1 pending transaction
      assert.equal((await multiSig.getTransactionCount(true, false)).toNumber(), 1);

      const txData = await multiSig.transactions(0);
      assert.equal(txData.to, testContract.address);
      assert.equal(txData.value.toNumber(), 0);
      assert.equal(txData.data, data);
      assert.equal(txData.executed, false);
    });

    it("Should not allow non-owners to submit transactions", async function () {
      const data = testContract.interface.encodeFunctionData("setValue", [42]);

      let error;
      try {
        await multiSig.connect(nonOwner).submitTransaction(testContract.address, 0, data);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Not an owner"), "Expected error message not found");
    });

    it("Should auto-approve transaction by the submitter", async function () {
      const data = testContract.interface.encodeFunctionData("setValue", [42]);
      await multiSig.submitTransaction(testContract.address, 0, data);

      // Check if the transaction is auto-approved by the submitter
      assert.equal(await multiSig.isApprovedBy(0, owner1.address), true);
      assert.equal((await multiSig.approvalCount(0)).toNumber(), 1);
    });

  });

  describe("Transaction Approval", function () {
    beforeEach(async function () {
      // Submit a transaction first
      const data = testContract.interface.encodeFunctionData("setValue", [42]);
      await multiSig.submitTransaction(testContract.address, 0, data);
    });

    it("Should allow owners to approve transactions", async function () {
      const tx = await multiSig.connect(owner2).approveTransaction(0);
      const receipt = await tx.wait();

      // Check if ApprovalReceived event was emitted
      const event = receipt.events.find(e => e.event === "ApprovalReceived");
      assert.ok(event, "ApprovalReceived event should be emitted");
      assert.equal(event.args[0], owner2.address);
      assert.equal(event.args[1].toNumber(), 0);

      assert.equal((await multiSig.approvalCount(0)).toNumber(), 2);
      assert.equal(await multiSig.isApprovedBy(0, owner2.address), true);
    });

    it("Should not allow non-owners to approve transactions", async function () {
      let error;
      try {
        await multiSig.connect(nonOwner).approveTransaction(0);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Not an owner"), "Expected error message not found");
    });

    it("Should not allow approving non-existent transactions", async function () {
      let error;
      try {
        await multiSig.approveTransaction(99);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Transaction does not exist"), "Expected error message not found");
    });

    it("Should prevent duplicate approvals from the same owner", async function () {
      // First approval was auto-added during submission
      // Try to approve again
      let error;
      try {
        await multiSig.approveTransaction(0);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Transaction already approved by this owner"), "Expected error message not found");
    });

    it("Should execute transaction when required approvals are met", async function () {
      // First approval was auto-added during submission
      // Second approval should trigger execution
      const tx = await multiSig.connect(owner2).approveTransaction(0);
      const receipt = await tx.wait();

      // Check if TransactionExecuted event was emitted
      const event = receipt.events.find(e => e.event === "TransactionExecuted");
      assert.ok(event, "TransactionExecuted event should be emitted");

      // Check if the transaction was marked as executed
      const txData = await multiSig.transactions(0);
      assert.equal(txData.executed, true);

      // Check if transaction is now inactive
      assert.equal(await multiSig.isActive(0), false);

      // Check if the value was set in the test contract
      assert.equal((await testContract.value()).toNumber(), 42);
    });
  });

  describe("Approval Revocation", function () {
    beforeEach(async function () {
      // Submit a transaction first
      const data = testContract.interface.encodeFunctionData("setValue", [42]);
      await multiSig.submitTransaction(testContract.address, 0, data);
    });

    it("Should allow owners to revoke their own approvals", async function () {
      // First approval was auto-added during submission
      assert.equal((await multiSig.approvalCount(0)).toNumber(), 1);

      // Revoke approval
      const tx = await multiSig.revokeApproval(0);
      const receipt = await tx.wait();

      // Check if ApprovalRevoked event was emitted
      const event = receipt.events.find(e => e.event === "ApprovalRevoked");
      assert.ok(event, "ApprovalRevoked event should be emitted");
      assert.equal(event.args[0], owner1.address);
      assert.equal(event.args[1].toNumber(), 0);

      // Approvals should be decremented
      assert.equal((await multiSig.approvalCount(0)).toNumber(), 0);
      assert.equal(await multiSig.isApprovedBy(0, owner1.address), false);
    });

    it("Should not allow revoking approvals for non-approved transactions", async function () {
      let error;
      try {
        await multiSig.connect(owner2).revokeApproval(0);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Transaction not approved by this owner"), "Expected error message not found");
    });

    it("Should not allow revoking approvals for expired transactions", async function () {
      // Increase time by 31 days (more than PROPOSAL_EXPIRATION)
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      // Mark the transaction as expired
      await multiSig.markExpiredTransaction(0);

      // Try to revoke approval on an expired transaction
      let error;
      try {
        await multiSig.revokeApproval(0);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Transaction has expired"), "Expected error message not found");
    });
  });

  describe("Transaction Cancellation", function () {
    beforeEach(async function () {
      // Submit a transaction first
      const data = testContract.interface.encodeFunctionData("setValue", [42]);
      await multiSig.submitTransaction(testContract.address, 0, data);
    });

    it("Should allow the creator to cancel a transaction", async function () {
      // Cancel the transaction
      const tx = await multiSig.cancelTransaction(0);
      const receipt = await tx.wait();

      // Check if TransactionCancelled event was emitted
      const event = receipt.events.find(e => e.event === "TransactionCancelled");
      assert.ok(event, "TransactionCancelled event should be emitted");
      assert.equal(event.args[0], owner1.address);
      assert.equal(event.args[1].toNumber(), 0);

      // Transaction should be inactive
      assert.equal(await multiSig.isActive(0), false);
    });

    it("Should not allow non-creator to cancel transaction without required approvals", async function () {
      let error;
      try {
        await multiSig.connect(owner2).cancelTransaction(0);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Only creator or consensus can cancel"), "Expected error message not found");
    });
  });

  describe("Transaction Expiration", function () {
    beforeEach(async function () {
      // Submit a transaction first
      const data = testContract.interface.encodeFunctionData("setValue", [42]);
      await multiSig.submitTransaction(testContract.address, 0, data);
    });

    it("Should not allow marking a transaction as expired before its time", async function () {
      let error;
      try {
        await multiSig.markExpiredTransaction(0);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Transaction has not expired yet"), "Expected error message not found");
    });

    it("Should mark a transaction as expired after the expiration time", async function () {
      // Increase time by 31 days (more than PROPOSAL_EXPIRATION)
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      const tx = await multiSig.markExpiredTransaction(0);
      const receipt = await tx.wait();

      // Check if TransactionExpired event was emitted
      const event = receipt.events.find(e => e.event === "TransactionExpired");
      assert.ok(event, "TransactionExpired event should be emitted");

      // Transaction should be inactive
      assert.equal(await multiSig.isActive(0), false);
    });
  });

  describe("Owner Management", function () {
    let addOwnerData;
    let removeOwnerData;
    let changeRequirementData;

    beforeEach(async function () {
      // Prepare data for ownership management transactions
      addOwnerData = await multiSig.buildOwnerTx("addOwner", nonOwner.address);
      removeOwnerData = await multiSig.buildOwnerTx("removeOwner", owner3.address);
      changeRequirementData = await multiSig.buildRequirementTx(1);
    });

    it("Should not allow direct owner management calls", async function () {
      let error;
      try {
        // Try to directly add an owner without going through multisig
        await multiSig.addOwner(nonOwner.address);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Only callable through wallet execution"), "Expected error message not found");
    });

    it("Should add a new owner through multisig approval", async function () {
      // Submit transaction to add new owner
      await multiSig.submitTransaction(multiSig.address, 0, addOwnerData);

      // Second approval should execute the transaction
      await multiSig.connect(owner2).approveTransaction(0);

      // Check if the new owner was added
      assert.equal(await multiSig.isOwner(nonOwner.address), true);

      // Owner count should now be 4
      const owners = await multiSig.getOwners();
      assert.equal(owners.length, 4);
    });

    it("Should remove an owner through multisig approval", async function () {
      // Submit transaction to remove owner3
      await multiSig.submitTransaction(multiSig.address, 0, removeOwnerData);

      // Second approval should execute the transaction
      await multiSig.connect(owner2).approveTransaction(0);

      // Check if owner3 was removed
      assert.equal(await multiSig.isOwner(owner3.address), false);

      // Owner count should now be 2
      const owners = await multiSig.getOwners();
      assert.equal(owners.length, 2);
    });

    it("Should change requirement through multisig approval", async function () {
      // Submit transaction to change required confirmations to 1
      await multiSig.submitTransaction(multiSig.address, 0, changeRequirementData);

      // Second approval should execute the transaction
      await multiSig.connect(owner2).approveTransaction(0);

      // Check if requirement was changed
      assert.equal((await multiSig.required()).toNumber(), 1);
    });

    it("Should replace an owner through multisig approval", async function () {
      // Build replace owner data
      const replaceOwnerData = await multiSig.buildReplaceTx(owner3.address, nonOwner.address);

      // Submit transaction to replace owner3 with nonOwner
      await multiSig.submitTransaction(multiSig.address, 0, replaceOwnerData);

      // Second approval should execute the transaction
      await multiSig.connect(owner2).approveTransaction(0);

      // Check if owner3 was replaced
      assert.equal(await multiSig.isOwner(owner3.address), false);
      assert.equal(await multiSig.isOwner(nonOwner.address), true);

      // Owner count should still be 3
      const owners = await multiSig.getOwners();
      assert.equal(owners.length, 3);
    });
  });

  describe("Complex Scenarios", function () {
    it("Should handle multiple transactions correctly", async function () {
      // Submit 3 different transactions
      for (let i = 1; i <= 3; i++) {
        const data = testContract.interface.encodeFunctionData("setValue", [i * 10]);
        await multiSig.submitTransaction(testContract.address, 0, data);
      }

      // Approve and execute transaction 1
      await multiSig.connect(owner2).approveTransaction(1);

      // Revoke auto-approval for transaction 0
      await multiSig.revokeApproval(0);

      // Cancel transaction 2
      await multiSig.cancelTransaction(2);

      // Verify states
      assert.equal((await multiSig.transactions(0)).executed, false);
      assert.equal((await multiSig.transactions(1)).executed, true);
      assert.equal((await multiSig.transactions(2)).executed, false);

      assert.equal((await multiSig.approvalCount(0)).toNumber(), 0);
      assert.equal(await multiSig.isActive(0), true);
      assert.equal(await multiSig.isActive(1), false); // Executed, so inactive
      assert.equal(await multiSig.isActive(2), false); // Cancelled, so inactive

      // Value in test contract should be from transaction 1
      assert.equal((await testContract.value()).toNumber(), 20);
    });

    it("Should maintain security during complex owner changes", async function () {
      // First add a new owner
      const addOwnerData = await multiSig.buildOwnerTx("addOwner", nonOwner.address);
      await multiSig.submitTransaction(multiSig.address, 0, addOwnerData);
      await multiSig.connect(owner2).approveTransaction(0);

      // Now require all 4 owners to approve
      const valueChangeData = testContract.interface.encodeFunctionData("setValue", [100]);
      await multiSig.submitTransaction(testContract.address, 0, valueChangeData);

      await multiSig.connect(nonOwner).approveTransaction(1);
      assert.equal(await multiSig.isOwner(nonOwner.address), true);
      assert.equal((await multiSig.transactions(0)).executed, true);
      assert.equal((await multiSig.transactions(1)).executed, true);

      // Verify requirement was changed
      assert.equal((await multiSig.required()).toNumber(), 2);

    });

    it("Should maintain security during complex owner changes2; Try a new transaction with new requirement", async function () {
      // First add a new owner
      const addOwnerData = await multiSig.buildOwnerTx("addOwner", nonOwner.address);
      await multiSig.submitTransaction(multiSig.address, 0, addOwnerData);
      await multiSig.connect(owner2).approveTransaction(0);

      // Now require all 4 owners to approve
      const changeReqData = await multiSig.buildRequirementTx(3);
      await multiSig.submitTransaction(multiSig.address, 0, changeReqData);
      await multiSig.connect(owner2).approveTransaction(1);


      // Verify requirement was changed
      assert.equal((await multiSig.required()).toNumber(), 3);

      // Now attempt to submit a value change transaction
      const valueChangeData = testContract.interface.encodeFunctionData("setValue", [100]);
      await multiSig.submitTransaction(testContract.address, 0, valueChangeData);

      // Approve from 2 owners but not the 3rd
      await multiSig.connect(nonOwner).approveTransaction(2);


      // Transaction should not be executed yet
      assert.equal((await multiSig.transactions(2)).executed, false);

      // Final approval should execute
      await multiSig.connect(owner2).approveTransaction(2);

      // Now the transaction should be executed
      assert.equal((await multiSig.transactions(2)).executed, true);
      assert.equal((await testContract.value()).toNumber(), 100);
    });
  });
});

