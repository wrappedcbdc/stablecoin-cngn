const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSig Cancel and Remove", function () {
  let MultiSig, multiSig;
  let owner1, owner2, owner3, nonOwner;
  let TestContract, testContract;
  const required = 2;

  beforeEach(async function () {
    [owner1, owner2, owner3, nonOwner] = await ethers.getSigners();

    MultiSig = await ethers.getContractFactory("MultiSig");
    multiSig = await MultiSig.deploy(
      [owner1.address, owner2.address, owner3.address],
      required
    );
    await multiSig.deployed();

    TestContract = await ethers.getContractFactory("TestContract");
    testContract = await TestContract.deploy();
    await testContract.deployed();
  });

  // Helper to submit a transaction and return its ID
  async function submitTransaction(data) {
    const tx = await multiSig.submitTransaction(
      testContract.address,
      0,
      data
    );
    const receipt = await tx.wait();
    const ev = receipt.events.find((e) => e.event === "TransactionCreated");
    return ev.args[1].toNumber();
  }

  describe("proposeCancelTransaction", function () {
    let txId;

    beforeEach(async function () {
      const data = testContract.interface.encodeFunctionData("setValue", [
        123,
      ]);
      txId = await submitTransaction(data);
    });

    it("owner can cast first cancel-vote", async function () {
      const tx = await multiSig.proposeCancelTransaction(txId);
      await expect(tx)
        .to.emit(multiSig, "CancelVoteCast")
        .withArgs(owner1.address, txId, 1);
      expect(await multiSig.cancelVoteCount(txId)).to.equal(1);
    });

    it("duplicate vote is reverted", async function () {
      await multiSig.proposeCancelTransaction(txId);
      await expect(
        multiSig.proposeCancelTransaction(txId)
      ).to.be.revertedWith("Already voted to cancel");
    });

    it("non-owner cannot vote", async function () {
      await expect(
        multiSig.connect(nonOwner).proposeCancelTransaction(txId)
      ).to.be.revertedWith("Not an owner");
    });

    it("second vote triggers cancellation", async function () {
      await multiSig.proposeCancelTransaction(txId);
      const tx = await multiSig.connect(owner2).proposeCancelTransaction(
        txId
      );
      await expect(tx)
        .to.emit(multiSig, "CancelVoteCast")
        .withArgs(owner2.address, txId, 2)
        .and.to.emit(multiSig, "TransactionCancelled")
        .withArgs(owner2.address, txId);
      expect(await multiSig.isCanceled(txId)).to.equal(true);
      expect(await multiSig.isActive(txId)).to.equal(false);
    });

    it("cannot cancel after canceled", async function () {
      await multiSig.proposeCancelTransaction(txId);
      await multiSig.connect(owner2).proposeCancelTransaction(txId);
      await expect(
        multiSig.proposeCancelTransaction(txId)
      ).to.be.revertedWith("Transaction is not active");
    });
  });

  describe("proposeRemoveTransaction", function () {
    let txId;

    beforeEach(async function () {
      // submit and fully cancel a transaction
      const data = testContract.interface.encodeFunctionData("setValue", [
        456,
      ]);
      txId = await submitTransaction(data);
      await multiSig.proposeCancelTransaction(txId);
      await multiSig.connect(owner2).proposeCancelTransaction(txId);
    });

    it("cannot remove before cancellation", async function () {
      const freshData = testContract.interface.encodeFunctionData("setValue", [
        789,
      ]);
      const freshId = await submitTransaction(freshData);
      await expect(
        multiSig.proposeRemoveTransaction(freshId)
      ).to.be.revertedWith("Must be canceled first");
    });

    it("owner can cast first remove-vote", async function () {
      const tx = await multiSig.proposeRemoveTransaction(txId);
      await expect(tx)
        .to.emit(multiSig, "RemoveVoteCast")
        .withArgs(owner1.address, txId, 1);
      expect(await multiSig.removeVoteCount(txId)).to.equal(1);
    });

    it("duplicate remove-vote is reverted", async function () {
      await multiSig.proposeRemoveTransaction(txId);
      await expect(
        multiSig.proposeRemoveTransaction(txId)
      ).to.be.revertedWith("Already voted to remove");
    });

    it("non-owner cannot vote", async function () {
      await expect(
        multiSig.connect(nonOwner).proposeRemoveTransaction(txId)
      ).to.be.revertedWith("Not an owner");
    });

    it("second vote triggers removal", async function () {
      await multiSig.proposeRemoveTransaction(txId);
      const tx = await multiSig.connect(owner2).proposeRemoveTransaction(
        txId
      );
      await expect(tx)
        .to.emit(multiSig, "RemoveVoteCast")
        .withArgs(owner2.address, txId, 2)
        .and.to.emit(multiSig, "TransactionRemoved")
        .withArgs(owner2.address, txId);
      expect(await multiSig.isRemoved(txId)).to.equal(true);
      // now transaction should no longer exist
      await expect(multiSig.transactions(txId)).to.be.revertedWith(
        "Transaction does not exist"
      );
    });

    it("cannot remove after removed", async function () {
      await multiSig.proposeRemoveTransaction(txId);
      await multiSig.connect(owner2).proposeRemoveTransaction(txId);
      await expect(
        multiSig.proposeRemoveTransaction(txId)
      ).to.be.revertedWith("Transaction does not exist");
    });
  });
});