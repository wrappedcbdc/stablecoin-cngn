const { assert } = require("chai");

const ChatsToken = artifacts.require("./ChatsToken.sol");
const operations = artifacts.require('Operations.sol');

require("chai")
  .use(require("chai-as-promised"))
  .should();

contract("ChatsToken", (accounts) => {
  let contract;

  before(async () => {
    operationsContract = await operations.deployed();
    contract = await ChatsToken.deployed('CHATS', 'CHS', operationsContract.address);
  });

  describe("Deployment", async () => {
    it("... successfully deployed", async () => {
      const address = contract.address;
      assert.notEqual(address, 0x0);
      assert.notEqual(address, "");
      assert.notEqual(address, null);
      assert.notEqual(address, undefined);
    });

    it("... correct contract name", async () => {
      const name = await contract.name();
      assert.equal(name, "CHATS");
    });

    it("... has the correct symbol", async () => {
      const symbol = await contract.symbol();
      assert.equal(symbol, "CHS");
    });

    it("... deployed with 1Mil FMY Token", async () => {
      const amount = await contract.totalSupply();
      assert.equal(amount, '0');
    });
  });

  describe("Minting and Redeeming", async () => {
    const amount = 10*10e18;
    it("... mints new tokens to SuperAdmin", async () => {
      
      const result = await contract.issue(amount.toString(), accounts[0]);
      const event = result.logs[0].args;
      assert.equal(event.value.toString(), amount.toString(), 'Issued amount is not correct');
    });

    it("... redeeming tokens from SuperAdmin", async () => {
      const result = await contract.redeem(amount.toString(), {from: accounts[0]});
      const bal = await contract.balanceOf(accounts[0]);
      const checkSupply = await contract.totalSupply();
      assert.equal(bal.toString(), checkSupply, 'Redeemed failed');
      
      const event = result.logs[0].args;
      assert.equal(event.value.toString(), amount.toString(), 'Redeemed amount is not correct'); 
    });
  });

  describe("ERC20 Functionalities", async () => {
    it("... transfer ", async () => {
      const amount = 10*10e18;
      await contract.issue(amount.toString(), accounts[0]);
      await operationsContract.SetUserList(accounts[1], { from: accounts[0] });
      const result = await contract.transfer(accounts[1], amount.toString()); //1000
      const bal = await contract.balanceOf(accounts[1]);
      assert.equal(bal.toString(), amount.toString()); //1000
      
      const event = result.logs[0].args;
      assert.equal(event.value, amount.toString(), 'Transfered amount is not correct'); //1000
    });

    it("... approve amount", async () => {
      const amount = 0.5*10e18;
      await operationsContract.SetUserList(accounts[2], { from: accounts[0] });
      // const result = await contract.approve(accounts[2], amount.toString(), {from: accounts[1]} ); //100FMY
      const wallet = new ethers.Wallet(_tokenOwnerPswd, provider);
    const signature = await signERC2612Permit(wallet, connect.contract.address, _tokenOwnerAddr, _spenderAddr, Number(value));
      const result = await contract.permit(accounts[1], accounts[2], amount.toString(), signature.deadline, signature.v, signature.r, signature.s)
      const event = result.logs[0].args;
      
      assert.equal(event.value, amount.toString(), 'Approved amount is not correct'); //100FMY
    });

    it("... allowance ", async () => {
      const amount = 0.5*10e18;
      const result = await contract.allowance(accounts[1], accounts[2], { from: accounts[2] });
      assert.equal(result.toString(), amount.toString(), 'Allowed amount is not correct'); //100FMY
    });

    it("... transferFrom ", async () => {
      const amount = 0.5*10e18;
      await operationsContract.SetUserList(accounts[3], { from: accounts[0] });

      const result = await contract.transferTokenFrom(accounts[1], accounts[3], amount.toString(), {from: accounts[2]}); //10FMY
      const bal = await contract.balanceOf(accounts[3]);
      const event = result.logs[0].args;
      assert.equal(bal.toString(), amount.toString());
      // assert.equal(event.value, amount.toString(), 'Transfered amount is not correct');
      
    });


  });

  // describe("OwnerShip Tranfer", async () => {
  //   it("... initiating Ownership Transfer", async () => {
  //     await operationsContract.SetUserList(accounts[4], { from: accounts[0] });
  //     await operationsContract.AddAdmin(accounts[4], { from: accounts[0] });
  //     const result = await contract.initiateOwnershipTransfer(accounts[4], { from: accounts[0] });
  //     const addr = await contract.proposedOwner();
          
  //     const event = result.logs[0].args;
  //     assert.equal(event.spender, addr, 'Proposed address is not correct');
  //   });

  //   it("... cancelling Ownership Transfer", async () => {
  //     const result = await contract.cancelOwnershipTransfer({ from: accounts[0] });
      
  //     assert.equal(result.receipt.status, true, 'cancelling Ownership Transferis not correct');
  //   });
        
  //   it("... completing Ownership Transfer", async () => {  
  //     await operationsContract.AddAdmin(accounts[3], { from: accounts[0] });
  //     await contract.initiateOwnershipTransfer(accounts[3], { from: accounts[0] });
  //     await contract.completeOwnershipTransfer({ from: accounts[3] });
      
  //     const result = await contract.owner();
  //     const addr = await contract.proposedOwner();
        
  //     assert.equal(addr, '0x0000000000000000000000000000000000000000', 'Proposed account should be emptyed.');
  //     assert.equal(result, accounts[3], 'New owner has not been changed');
  //   });
  // });

  describe("Operations Contract", async () => {
    it("... adding blackListed user", async () => {
      const result = await operationsContract.AddBlackList(accounts[1], { from: accounts[0] });
      const event = result.logs[0].args;

      assert.equal(event._user, accounts[1], 'Address is added to Blocklist');
    });

    it("... destroying blackListed user's Fund", async () => {
      const bal = await contract.balanceOf(accounts[1]);
      await contract.redeem(bal, { from: accounts[1] });
      const bal1 = await contract.balanceOf(accounts[1]);
      assert.notEqual(bal.toString(), bal1.toString(), 'balances amount not destroyed')
    });

    it("... removing user from BlackList", async () => {
      const result1 = await operationsContract.RemoveBlackList(accounts[1], { from: accounts[0] });
      const event1 = result1.logs[0].args;

      assert.equal(event1._user, accounts[1])
    });

  });
});
