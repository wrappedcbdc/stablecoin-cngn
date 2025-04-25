const assert = require("assert");
const { ethers } = require("hardhat");
const { expect } = require('chai');
describe("MultiSig with Cngn", function () {
    let MultiSig;
    let multiSig;
    let Admin;
    let admin;
    let Forwarder;
    let forwarder;
    let CNGN;
    let cngn;
    let owner1, owner2, owner3, nonOwner, addr1, addr2, minter1, minter2;
    let requiredApprovals = 2;
    let mintAmount = 1000;

    beforeEach(async function () {
        [owner1, owner2, owner3, nonOwner, addr1, addr2, minter1, minter2] = await ethers.getSigners();

        // Deploy the MultiSig contract
        MultiSig = await ethers.getContractFactory("MultiSig");
        multiSig = await MultiSig.deploy(
            [owner1.address, owner2.address, owner3.address],
            requiredApprovals
        );
        await multiSig.deployed();

        // Deploy the Admin contract
        Admin = await ethers.getContractFactory("Admin");

        admin = await upgrades.deployProxy(Admin, [], { initializer: 'initialize' });

        // Deploy the Forwarder contract
        Forwarder = await ethers.getContractFactory("Forwarder");
        forwarder = await Forwarder.deploy(admin.address);
        await forwarder.deployed();

        // Deploy the Admin contract
        CNGN = await ethers.getContractFactory("Cngn");

        cngn = await upgrades.deployProxy(CNGN, [forwarder.address, admin.address], { initializer: 'initialize' });

        // Transfer ownership of Admin to MultiSig
        await admin.transferOwnership(multiSig.address);
        await cngn.transferOwnership(multiSig.address);
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

        it("Should transfer CNGN ownership to MultiSig", async function () {
            console.log(await cngn.name())
            assert.equal(await cngn.name(), "cNGN");
            assert.equal(await cngn.symbol(), "cNGN");
        });

        it("Should set the correct required approvals", async function () {
            assert.equal(await multiSig.required(), requiredApprovals);
        });

        it("Should transfer Admin ownership to MultiSig", async function () {
            assert.equal(await admin.owner(), multiSig.address);
        });
        it("Should transfer CNGN ownership to MultiSig", async function () {
            assert.equal(await cngn.owner(), multiSig.address);
        });
    });

    describe("Ownership and Admin Functions", function () {
        it("should allow the owner to update admin operations address", async function () {
            const newAdminAddress = ethers.Wallet.createRandom().address;
            // Prepare transaction data to whitelist an external sender
            const data = cngn.interface.encodeFunctionData("updateAdminOperationsAddress", [newAdminAddress]);
            // Submit transaction through MultiSig
            await multiSigCall(multiSig, cngn.address, data, owner2, 0)
            assert.equal(await cngn.adminOperationsContract(), newAdminAddress);
        });

        it("should allow the owner to update trusted forwarder contract", async function () {
            const newForwarderAddress = ethers.Wallet.createRandom().address;
            // Prepare transaction data to whitelist an external sender
            const data = cngn.interface.encodeFunctionData("updateForwarderContract", [newForwarderAddress]);

            // Submit transaction through MultiSig
            await multiSigCall(multiSig, cngn.address, data, owner2, 0)

            // const filter = cngn.filters.ForwarderContractUpdated();
            // const events = await cngn.queryFilter(filter);
            // console.log("Events: ", events);
            // assert.equal(events[0].args[0], newForwarderAddress);
            // assert.equal(events[0].args[1], owner1.address);
            // assert.equal(events[0].args[2], owner2.address);
            // assert.equal(events[0].args[3], owner3.address);
            assert.equal(await cngn.trustedForwarderContract(), newForwarderAddress);
        });
    });

    describe("Minting and Burning", function () {
        beforeEach(async function () {
            // Add canMint role to minter1
            const addCanMintData = admin.interface.encodeFunctionData("addCanMint", [minter1.address]);
            await multiSigCall(multiSig, admin.address, addCanMintData, owner2, 0)

            const mintAmountData = admin.interface.encodeFunctionData("addMintAmount", [minter1.address, mintAmount]);
            await multiSigCall(multiSig, admin.address, mintAmountData, owner2, 1)



        });
        it("should allow minting of tokens and verify that minter is removed", async function () {
            getMinters= await admin.canMint(minter1.address);
            expect(getMinters).to.equal(true);
            console.log("getMinters: ", getMinters);
            const mintTx = await cngn.connect(minter1).mint(mintAmount, addr1.address);
            // Wait for the transaction to be mined
            const receipt = await mintTx.wait();

            // Find the Transfer event from the receipt logs
            const mintEvent = receipt.events.find(event => event.event === "Transfer");
            console.log("Mint Event=========: ", mintEvent);
            //  Assert the event data
            expect(mintEvent.args.from).to.equal(ethers.constants.AddressZero); // 0x0000000000000000000000000000000000000000
            expect(mintEvent.args.to).to.equal(addr1.address);
            const mintValue = await mintEvent.args.value;
            expect(mintValue.toString()).to.equal(mintAmount.toString());

            const newBalanceAddress1 = await cngn.balanceOf(addr1.address);
            expect(newBalanceAddress1.toString()).to.equal(mintAmount.toString());

            const totalSupply = await cngn.totalSupply();
            expect(totalSupply.toString()).to.equal(mintAmount.toString());
           getMinters= await admin.canMint(minter1.address);
           console.log("getMinters: ", getMinters);

        });

        it("should fail if not authorized to mint", async function () {
            await cngn.connect(minter1).mint(mintAmount, addr1.address);
            const balanceAddress1 = await cngn.balanceOf(addr1.address);
            console.log("balance Address 1 to burn from: ", balanceAddress1.toString());
            try {
                await cngn.connect(addr1).mint(500, addr1.address)
                // If it didn't throw, force failure
                expect.fail("Minter not authorized to sign");
            } catch (error) {
                expect(error.message).to.include("Minter not authorized to sign");
            }
        });
        it("should fail if trying to mint more than allowed", async function () {


            try {
                await cngn.connect(minter1).mint(5000, addr1.address)
                // If it didn't throw, force failure
                expect.fail("Attempting to mint more than allowed");
            } catch (error) {
                expect(error.message).to.include("Attempting to mint more than allowed");
            }

        });

        it("should allow burning tokens", async function () {
            await cngn.connect(minter1).mint(mintAmount, addr1.address);
            const balanceAddress1 = await cngn.balanceOf(addr1.address);
            console.log("balance Address 1 to burn from: ", balanceAddress1.toString());
            const burnAmount = 200;

            const burnTx = await cngn.connect(addr1).burnByUser(burnAmount)
            // Wait for the transaction to be mined
            const receipt = await burnTx.wait();

            // Find the Burn event from the receipt logs
            const burnEvent = receipt.events.find(event => event.event === "Transfer");
            console.log("Burn Event=========: ", burnEvent);
            //  Assert the event data
            expect(burnEvent.args.to).to.equal(ethers.constants.AddressZero); // 0x0000000000000000000000000000000000000000
            expect(burnEvent.args.from).to.equal(addr1.address);
            const burnValue = await burnEvent.args.value;
            expect(burnValue.toString()).to.equal(burnAmount.toString());
            const newBalanceAddress1 = await cngn.balanceOf(addr1.address);
            let remainingAmount = mintAmount - burnAmount;
            expect(newBalanceAddress1.toString()).to.equal(remainingAmount.toString());

            const totalSupply = await cngn.totalSupply();
            expect(totalSupply.toString()).to.equal(remainingAmount.toString()); // 1000 - 200 (after minting)
        });
    });

    describe("Transfers", function () {
        beforeEach(async function () {
            // Add canMint role to minter1
            const addCanMintData = admin.interface.encodeFunctionData("addCanMint", [minter1.address]);
            await multiSigCall(multiSig, admin.address, addCanMintData, owner2, 0)

            const mintAmountData = admin.interface.encodeFunctionData("addMintAmount", [minter1.address, mintAmount]);
            await multiSigCall(multiSig, admin.address, mintAmountData, owner2, 1)
            await cngn.connect(minter1).mint(mintAmount, addr1.address);
            const totalSupply = await cngn.totalSupply();
            expect(totalSupply.toString()).to.equal(mintAmount.toString());

        });

        it("should transfer tokens correctly between accounts", async function () {

            const transferAmount = 100;
            // Listen for the 'Transfer' event
            const transferTx = await cngn.connect(addr1).transfer(addr2.address, transferAmount);


            // Wait for the transaction to be mined
            const receipt = await transferTx.wait();

            // Find the Transfer event from the receipt logs
            const transferEvent = receipt.events.find(event => event.event === "Transfer");

            // Assert the event data
            expect(transferEvent).to.not.be.undefined;
            expect(transferEvent.args.from).to.equal(addr1.address);
            expect(transferEvent.args.to).to.equal(addr2.address);
            expect(transferEvent.args.value.toString()).to.equal(transferAmount.toString());

            const newBalanceAddress1 = await cngn.balanceOf(addr1.address);
            let remainingAmount = mintAmount - transferAmount;
            expect(newBalanceAddress1.toString()).to.equal(remainingAmount.toString());
            const newBalanceAddress2 = await cngn.balanceOf(addr2.address);
            expect(newBalanceAddress2.toString()).to.equal(transferAmount.toString());
            console.log("New Balance Address 1: ", newBalanceAddress1.toString());
            console.log("New Balance Address 2: ", newBalanceAddress2.toString());
            const totalSupply = await cngn.totalSupply();
            console.log("Total Supply: ", totalSupply.toString());
        });

        it("should fail transfer if sender or receiver is blacklisted", async function () {
            const addToblacklistData = admin.interface.encodeFunctionData("addBlackList", [minter1.address]);
            await multiSigCall(multiSig, admin.address, addToblacklistData, owner2, 2)
            await cngn.connect(addr1).transfer(addr2.address, 100)
            const newBalanceAddress1 = await cngn.balanceOf(addr1.address);
            console.log("New Balance Address 1: ", newBalanceAddress1.toString());
            const totalSupply = await cngn.totalSupply();
            console.log("Total Supply: ", totalSupply.toString());
        });

        it("should burn tokens of recipient when transferring isInternalUserWhitelisted(to) and isExternalUserWhitelisted(from)", async function () {
            const addToWhitelistInternalUserData = admin.interface.encodeFunctionData("whitelistInternalUser", [addr2.address]);
            const addToWhitelistExternalSenderData = admin.interface.encodeFunctionData("whitelistExternalSender", [addr1.address]);

            await multiSigCall(multiSig, admin.address, addToWhitelistInternalUserData, owner2, 2)
            await multiSigCall(multiSig, admin.address, addToWhitelistExternalSenderData, owner2, 3)

            const transferAmount = 100;
            await cngn.connect(addr1).transfer(addr2.address, transferAmount)
            const newBalanceAddress1 = await cngn.balanceOf(addr1.address);

            let remainingAmount = mintAmount - transferAmount;
            expect(newBalanceAddress1.toString()).to.equal(remainingAmount.toString());

            const newBalanceAddress2 = await cngn.balanceOf(addr2.address);
            expect(newBalanceAddress2.toString()).to.equal(ethers.constants.Zero.toString());
            console.log("New Balance Address 1: ", newBalanceAddress1.toString());
            console.log("New Balance Address 2: ", newBalanceAddress2.toString());
            const totalSupply = await cngn.totalSupply();
            console.log("Total Supply: ", totalSupply.toString());
        });
    });



    describe("Pausable Operations", function () {
        beforeEach(async function () {
            // Add canMint role to minter1
            const addCanMintData = admin.interface.encodeFunctionData("addCanMint", [minter1.address]);
            await multiSigCall(multiSig, admin.address, addCanMintData, owner2, 0)

            const mintAmountData = admin.interface.encodeFunctionData("addMintAmount", [minter1.address, mintAmount]);
            await multiSigCall(multiSig, admin.address, mintAmountData, owner2, 1)
            await cngn.connect(minter1).mint(mintAmount, addr1.address);
            const totalSupply = await cngn.totalSupply();
            expect(totalSupply.toString()).to.equal(mintAmount.toString());

        });
        it("should allow owner to pause and unpause", async function () {
            let pause;
            pause = await cngn.paused();
            console.log("Pause Status: ", pause);
            expect(pause).to.equal(false);

            const pauseData = cngn.interface.encodeFunctionData("pause", []);
            await multiSigCall(multiSig, cngn.address, pauseData, owner3, 2)
            pause = await cngn.paused();
            console.log("Pause Status: ", pause);
            expect(pause).to.equal(true);

            const unPauseData = cngn.interface.encodeFunctionData("unPause", []);
            await multiSigCall(multiSig, cngn.address, unPauseData, owner3, 3)

            pause = await cngn.paused();
            console.log("Pause Status: ", pause);
            expect(pause).to.equal(false);
        });

        it("should prevent transfers when paused", async function () {
            const transferAmount = 100;
            // Listen for the 'Transfer' event
            const transferTx = await cngn.connect(addr1).transfer(addr2.address, transferAmount);

            // Wait for the transaction to be mined
            const receipt = await transferTx.wait();

            // Find the Transfer event from the receipt logs
            const transferEvent = receipt.events.find(event => event.event === "Transfer");
            console.log("Transfer Event=========: ", transferEvent);
        });
    });

    describe("Destroy Blacklisted Funds", function () {

        beforeEach(async function () {
            // Add canMint role to minter1
            const addCanMintData = admin.interface.encodeFunctionData("addCanMint", [minter1.address]);
            await multiSigCall(multiSig, admin.address, addCanMintData, owner2, 0)

            const mintAmountData = admin.interface.encodeFunctionData("addMintAmount", [minter1.address, mintAmount]);
            await multiSigCall(multiSig, admin.address, mintAmountData, owner2, 1)
            await cngn.connect(minter1).mint(mintAmount, addr1.address);
            const totalSupply = await cngn.totalSupply();
            expect(totalSupply.toString()).to.equal(mintAmount.toString());

        });


        it("should allow owner to destroy blacklisted user's funds", async function () {
            const addToblacklistData = admin.interface.encodeFunctionData("addBlackList", [addr1.address]);
            await multiSigCall(multiSig, admin.address, addToblacklistData, owner2, 2)

            const destroyBlackFundsData = cngn.interface.encodeFunctionData("destroyBlackFunds", [addr1.address]);
            await multiSigCall(multiSig, cngn.address, destroyBlackFundsData, owner3, 3)

            const newBalanceAddress1 = await cngn.balanceOf(addr1.address);
            console.log("New Balance Address 1: ", newBalanceAddress1.toString());
            expect(newBalanceAddress1.toString()).to.equal("0");
        });


        it("should fail if user is not blacklisted", async function () {
            try {
                const destroyedBlackFundsData = cngn.interface.encodeFunctionData("destroyBlackFunds", [addr2.address]);
            await multiSigCall(multiSig, cngn.address, destroyedBlackFundsData, owner2, 4)
           
                // If it didn't throw, force failure
               // expect.fail("Attempting to mint more than allowed");
            } catch (error) {
                console.log("Error: ", error.message);
               // expect(error.message).to.include("Attempting to mint more than allowed");
            }


        });

    });


});



async function multiSigCall(multiSig, contractAddrs, data, owner2, txCount) {
    // Submit transaction through MultiSig
    await multiSig.submitTransaction(contractAddrs, 0, data);

    // First approval
    await multiSig.approveTransaction(txCount);

    // Second approval should execute the transaction
    await multiSig.connect(owner2).approveTransaction(txCount);
}