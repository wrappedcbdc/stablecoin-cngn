const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Cngn2 (cNGN Token) — Functional Tests", function () {
  let Admin, admin;
  let Cngn, cngn;
  let owner, user1, user2;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy Admin2
    Admin = await ethers.getContractFactory("Admin2");
    admin = await upgrades.deployProxy(Admin, [], {
      initializer: "initialize",
    });
    await admin.deployed();

    // Deploy Cngn2
    Cngn = await ethers.getContractFactory("Cngn2");
    cngn = await upgrades.deployProxy(Cngn, [owner.address, admin.address], {
      initializer: "initialize",
    });
    await cngn.deployed();

    // Whitelist cngn in admin
    await admin.connect(owner).addTrustedContract(cngn.address);
  });

  describe("Pausable behavior", function () {
    it("owner can pause and unpause; transfers revert when paused", async () => {
      // Mint some tokens to user1
      await admin.connect(owner).addCanMint(user1.address);
      await admin.connect(owner).addMintAmount(user1.address, 100);
      await cngn.connect(user1).mint(100, user1.address);

      // Pause
      await cngn.connect(owner).pause();
      await expect(
        cngn.connect(user1).transfer(user2.address, 10)
      ).to.be.revertedWith("Pausable: paused");

      // Unpause
      await cngn.connect(owner).unPause();
      await expect(cngn.connect(user1).transfer(user2.address, 10)).to.emit(
        cngn,
        "Transfer"
      );
    });

    it("non-owner cannot pause or unpause", async () => {
      await expect(cngn.connect(user1).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(cngn.connect(user1).unPause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("AdminOperations address updates", function () {
    it("owner can update adminOperationsContract", async () => {
      await cngn.connect(owner).updateAdminOperationsAddress(user2.address);
      expect(await cngn.adminOperationsContract()).to.equal(user2.address);
    });
    it("non-owner cannot update adminOperationsContract", async () => {
      await expect(
        cngn.connect(user1).updateAdminOperationsAddress(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Mint & Removal Flow", function () {
    it("mint via Cngn2 and revokes permissions in Admin2", async () => {
      // Grant rights
      await admin.connect(owner).addCanMint(user1.address);
      await admin.connect(owner).addMintAmount(user1.address, 50);

      // Mint
      await expect(cngn.connect(user1).mint(50, user1.address))
        .to.emit(cngn, "Transfer")
        .withArgs(ethers.constants.AddressZero, user1.address, 50);

      // Verify Admin2 updates
      expect(await admin.canMint(user1.address)).to.be.false;
      expect((await admin.mintAmount(user1.address)).toString()).to.equal("0");
      // Verify balance
      expect((await cngn.balanceOf(user1.address)).toString()).to.equal("50");
    });
  });

  describe("Burn & Destroy Black Funds", function () {
    it("user can burn, and only owner can destroy blacklisted funds", async () => {
      // Mint and burn
      await admin.connect(owner).addCanMint(user1.address);
      await admin.connect(owner).addMintAmount(user1.address, 20);
      await cngn.connect(user1).mint(20, user1.address);

      await expect(cngn.connect(user1).burnByUser(5))
        .to.emit(cngn, "Transfer")
        .withArgs(user1.address, ethers.constants.AddressZero, 5);
      expect((await cngn.balanceOf(user1.address)).toString()).to.equal("15");

      // Blacklist and attempt destroy
      await admin.connect(owner).addBlackList(user1.address);
      await expect(
        cngn.connect(user1).destroyBlackFunds(user1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(cngn.connect(owner).destroyBlackFunds(user1.address))
        .to.emit(cngn, "DestroyedBlackFunds")
        .withArgs(user1.address, 15);
      expect((await cngn.balanceOf(user1.address)).toString()).to.equal("0");
    });
  });
});
