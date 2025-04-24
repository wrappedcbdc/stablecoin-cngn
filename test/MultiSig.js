const assert = require("assert");
const { ethers } = require("hardhat");

describe("MultiSig", function () {
  let MultiSig;
  let multiSig;
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
    
    // Deploy a simple test contract that will be called by the MultiSig
    TestContract = await ethers.getContractFactory("TestContract");
    testContract = await TestContract.deploy();
    await testContract.deployed();
  });

  describe("Deployment", function () {
    it("Should set the correct owners", async function () {
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
      assert.ok(error.message.includes("Invalid address"), "Expected error message not found");
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
      
      assert.equal((await multiSig.getTransactionCount()).toNumber(), 1);
      
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
  });

  describe("Transaction Approval", function () {
    beforeEach(async function () {
      // Submit a transaction first
      const data = testContract.interface.encodeFunctionData("setValue", [42]);
      await multiSig.submitTransaction(testContract.address, 0, data);
    });

    it("Should allow owners to approve transactions", async function () {
      const tx = await multiSig.approveTransaction(0);
      const receipt = await tx.wait();
      
      // Check if TransactionApproved event was emitted
      const event = receipt.events.find(e => e.event === "TransactionApproved");
      assert.ok(event, "TransactionApproved event should be emitted");
      assert.equal(event.args[0], owner1.address);
      assert.equal(event.args[1].toNumber(), 0);
      
      assert.equal((await multiSig.approvals(0)).toNumber(), 1);
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

    it("Should execute transaction when required approvals are met", async function () {
      // First approval
      await multiSig.approveTransaction(0);
      
      // Second approval should trigger execution
      const tx = await multiSig.connect(owner2).approveTransaction(0);
      const receipt = await tx.wait();
      
      // Check if TransactionExecuted event was emitted
      const event = receipt.events.find(e => e.event === "TransactionExecuted");
      assert.ok(event, "TransactionExecuted event should be emitted");
      assert.equal(event.args[0], owner2.address);
      assert.equal(event.args[1].toNumber(), 0);

      // Check if the transaction was marked as executed
      const txData = await multiSig.transactions(0);
      assert.equal(txData.executed, true);
      
      // Check if the value was set in the test contract
      assert.equal((await testContract.value()).toNumber(), 42);
    });
  });

  describe("Transaction Execution", function () {
    beforeEach(async function () {
      // Submit a transaction first
      const data = testContract.interface.encodeFunctionData("setValue", [42]);
      await multiSig.submitTransaction(testContract.address, 0, data);
    });

    it("Should not allow executing a transaction with insufficient approvals", async function () {
      // Only one approval
      await multiSig.approveTransaction(0);
      
      // Try to execute
      let error;
      try {
        await multiSig.executeTransaction(0);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Not enough approvals"), "Expected error message not found");
    });

    it("Should not allow executing a transaction that doesn't exist", async function () {
      let error;
      try {
        await multiSig.executeTransaction(99);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Transaction does not exist"), "Expected error message not found");
    });

    it("Should not allow executing an already executed transaction", async function () {
      // Two approvals
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Transaction is now executed
      
      // Try to execute again
      let error;
      try {
        await multiSig.executeTransaction(0);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Transaction already executed"), "Expected error message not found");
    });

    it("Should handle ETH transfer transactions", async function () {
      // Fund the multisig contract
      await owner1.sendTransaction({
        to: multiSig.address,
        value: ethers.utils.parseEther("1.0")
      });
      
      const initialBalance = await ethers.provider.getBalance(owner3.address);
      
      // Submit transaction to send ETH
      await multiSig.submitTransaction(
        owner3.address,
        ethers.utils.parseEther("0.5"),
        owner2.address,
      );
      
      // Approve and execute
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      // Check if ETH was transferred
      const finalBalance = await ethers.provider.getBalance(owner3.address);
      assert.equal(
        finalBalance.sub(initialBalance).toString(),
        ethers.utils.parseEther("0.5").toString()
      );
    });
  });

  describe("Transaction Rejection", function () {
    beforeEach(async function () {
      // Submit a transaction first
      const data = testContract.interface.encodeFunctionData("setValue", [42]);
      await multiSig.submitTransaction(testContract.address, 0, data);
    });

    it("Should allow owners to reject transactions", async function () {
      // First approval
      await multiSig.approveTransaction(0);
      assert.equal((await multiSig.approvals(0)).toNumber(), 1);
      
      // Reject the transaction
      const tx = await multiSig.rejectTransaction(0);
      const receipt = await tx.wait();
      
      // Check if TransactionRejected event was emitted
      const event = receipt.events.find(e => e.event === "TransactionRejected");
      assert.ok(event, "TransactionRejected event should be emitted");
      assert.equal(event.args[0], owner1.address);
      assert.equal(event.args[1].toNumber(), 0);
      
      // Approvals should be reset
      assert.equal((await multiSig.approvals(0)).toNumber(), 0);
    });

    it("Should not allow non-owners to reject transactions", async function () {
      let error;
      try {
        await multiSig.connect(nonOwner).rejectTransaction(0);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Not an owner"), "Expected error message not found");
    });

    it("Should not allow rejecting transactions that already have required approvals", async function () {
      // Two approvals (meeting required threshold)
      await multiSig.approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      
      // Try to reject
      let error;
      try {
        await multiSig.rejectTransaction(0);
      } catch (e) {
        error = e;
      }
      assert.ok(error, "Expected an error but did not get one");
      assert.ok(error.message.includes("Cannot reject executed or approved transactions"), "Expected error message not found");
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
      await multiSig.approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);
      
      // Approve but don't fully approve transaction 0
      await multiSig.approveTransaction(0);
      
      // Reject transaction 2
      await multiSig.rejectTransaction(2);
      
      // Verify states
      assert.equal((await multiSig.transactions(0)).executed, false);
      assert.equal((await multiSig.transactions(1)).executed, true);
      assert.equal((await multiSig.transactions(2)).executed, false);
      
      assert.equal((await multiSig.approvals(0)).toNumber(), 1);
      assert.equal((await multiSig.approvals(2)).toNumber(), 0);
      
      // Value in test contract should be from transaction 1
      assert.equal((await testContract.value()).toNumber(), 20);
    });

    // it("Should handle failed execution gracefully", async function () {
    //   // Deploy a contract that can fail on purpose
    //   FailingContract = await ethers.getContractFactory("FailingContract");
    //   failingContract = await FailingContract.deploy();
    //   await failingContract.deployed();
      
    //   // Submit transaction that will fail
    //   const data = failingContract.interface.encodeFunctionData("failingFunction");
    //   await multiSig.submitTransaction(failingContract.address, 0, data);
      
    //   // Approve the transaction
    //   await multiSig.approveTransaction(0);
      
    //   // Second approval should try to execute but fail
    //   let error;
    //   try {
    //     await multiSig.connect(owner2).approveTransaction(0);
    //   } catch (e) {
    //     error = e;
    //   }
    //   assert.ok(error, "Expected an error but did not get one");
    //   assert.ok(error.message.includes("Transaction failed"), "Expected error message not found");
      
    //   // Transaction should not be marked as executed
    //   assert.equal((await multiSig.transactions(0)).executed, false);
    // });
  });
});

