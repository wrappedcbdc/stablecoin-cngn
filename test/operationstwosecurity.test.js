const { expect } = require("chai");
require("@nomiclabs/hardhat-waffle");
const { ethers, upgrades } = require("hardhat");

describe("Operations2 Security", function () {
  let admin, cngn;
  let owner, user1, user2, user3;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    const Admin = await ethers.getContractFactory("Admin2");
    admin = await upgrades.deployProxy(Admin, [], {
      initializer: "initialize",
    });
    await admin.deployed();

    const Cngn = await ethers.getContractFactory("Cngn2");
    cngn = await upgrades.deployProxy(Cngn, [owner.address, admin.address], {
      initializer: "initialize",
    });
    await cngn.deployed();

    // Whitelist Cngn2 as a trusted contract
    await admin.connect(owner).addTrustedContract(cngn.address);
  });

  describe("Access Control for removal functions", function () {
    it("should revert when non-owner/non-trusted calls removeCanMint", async function () {
      await expect(
        admin.connect(user1).removeCanMint(user2.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("should revert when non-owner/non-trusted calls removeMintAmount", async function () {
      await expect(
        admin.connect(user1).removeMintAmount(user2.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("owner can successfully call removeCanMint", async function () {
      // Setup: owner grants minting rights to user2
      await admin.connect(owner).addCanMint(user2.address);
      expect(await admin.canMint(user2.address)).to.be.true;

      // Owner removes minting rights
      await expect(admin.connect(owner).removeCanMint(user2.address))
        .to.emit(admin, "BlackListedMinter")
        .withArgs(user2.address);
      expect(await admin.canMint(user2.address)).to.be.false;
    });

    it("owner can successfully call removeMintAmount", async function () {
      // Setup: owner grants minting and sets mint amount for user2
      await admin.connect(owner).addCanMint(user2.address);
      await admin.connect(owner).addMintAmount(user2.address, 500);
      // Use string comparison for BigNumber
      expect((await admin.mintAmount(user2.address)).toString()).to.equal(
        "500"
      );

      // Owner removes the mint amount
      await expect(admin.connect(owner).removeMintAmount(user2.address))
        .to.emit(admin, "MintAmountRemoved")
        .withArgs(user2.address);
      expect((await admin.mintAmount(user2.address)).toString()).to.equal("0");
    });
  });

  describe("Cngn2 contract mint flow capable of removal", function () {
    it("Cngn2 can mint and indirectly call removal functions", async function () {
      // Setup: owner grants mint rights and mint amount to user3
      await admin.connect(owner).addCanMint(user3.address);
      await admin.connect(owner).addMintAmount(user3.address, 1000);

      // User3 performs mint through Cngn2
      await expect(cngn.connect(user3).mint(1000, user3.address))
        .to.emit(cngn, "Transfer")
        .withArgs(ethers.constants.AddressZero, user3.address, 1000);

      // Confirm the removal of privileges in Admin2
      expect(await admin.canMint(user3.address)).to.be.false;
      expect((await admin.mintAmount(user3.address)).toString()).to.equal("0");

      // Confirm cNGN balance update
      expect((await cngn.balanceOf(user3.address)).toString()).to.equal("1000");
    });
  });
});
