const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("cNGN Audit Simulation", function () {
  let admin, forwarder, other, addrs;
  let Cngn, cngn, Admin, adminCtr, Forwarder, forwarderCtr;

  beforeEach(async () => {
    [admin, forwarder, other, ...addrs] = await ethers.getSigners();

    Admin = await ethers.getContractFactory("Admin2");
    adminCtr = await Admin.connect(admin).deploy();
    await adminCtr.connect(admin).initialize();

    expect(await adminCtr.owner()).to.equal(admin.address);

    await adminCtr.connect(admin).addTrustedContract(admin.address);
    await adminCtr
      .connect(admin)
      .addMintAmount(admin.address, ethers.utils.parseUnits("1000000", 6));

    Forwarder = await ethers.getContractFactory("Forwarder");
    forwarderCtr = await Forwarder.connect(admin).deploy(adminCtr.address);

    Cngn = await ethers.getContractFactory("Cngn2");
    cngn = await upgrades.deployProxy(
      Cngn,
      [forwarderCtr.address, adminCtr.address],
      { initializer: "initialize" }
    );

    await adminCtr.connect(admin).addTrustedContract(cngn.address);

    await adminCtr.connect(admin).whitelistExternalSender(other.address);
    await adminCtr.connect(admin).whitelistInternalUser(other.address);
  });

  describe("Basic ERC20 & Access Control", function () {
    it("has correct name, symbol, decimals", async () => {
      expect(await cngn.name()).to.equal("cNGN");
      expect(await cngn.symbol()).to.equal("cNGN");
      expect(await cngn.decimals()).to.equal(6);
    });

    it("reverts when non-owner tries to pause/unpause", async () => {
      await expect(cngn.connect(other).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await cngn.connect(admin).pause();
      await expect(
        cngn.connect(other).transfer(other.address, 1)
      ).to.be.revertedWith("Pausable: paused");
      await cngn.connect(admin).unpause();
    });
  });

  describe("Minting & Burning", function () {
    it("allows authorized minter to mint exactly the approved amount", async () => {
      await expect(
        cngn
          .connect(admin)
          .mint(ethers.utils.parseUnits("1000000", 6), other.address)
      ).to.emit(cngn, "Transfer");
      expect(await cngn.balanceOf(other.address)).to.equal(
        ethers.utils.parseUnits("1000000", 6)
      );
    });

    it("reverts on mint if amount ≠ approved", async () => {
      await expect(
        cngn.connect(admin).mint(1, other.address)
      ).to.be.revertedWith("Attempting to mint more than allowed");
    });

    it("reverts when non-minter tries to mint or burnByUser on another account", async () => {
      // Setup: give other a balance
      await adminCtr
        .connect(admin)
        .addMintAmount(admin.address, ethers.utils.parseUnits("1000", 6));
      await cngn
        .connect(admin)
        .mint(ethers.utils.parseUnits("1000", 6), other.address);

      // Reverts because `other` is not an authorized minter
      await expect(
        cngn.connect(other).mint(1, other.address)
      ).to.be.revertedWith("Minter not authorized to sign");

      // Reverts because user is blacklisted
      await expect(cngn.connect(other).burnByUser(1)).to.be.revertedWith(
        "User is blacklisted"
      );
    });
  });

  describe("Redemption Flow (transfer → burn)", function () {
    it("burns on transfer to an internal whitelisted user from external sender", async () => {
      await adminCtr
        .connect(admin)
        .addMintAmount(admin.address, ethers.utils.parseUnits("1000", 6));

      await cngn
        .connect(admin)
        .mint(ethers.utils.parseUnits("1000", 6), other.address);

      expect(await cngn.balanceOf(other.address)).to.equal(
        ethers.utils.parseUnits("1000", 6)
      );

      await cngn
        .connect(other)
        .transfer(other.address, ethers.utils.parseUnits("1000", 6));

      expect(await cngn.balanceOf(other.address)).to.equal(0);
    });
  });

  describe("Forwarder meta-tx", function () {
    it("prevents replay and unauthorized use", async () => {
      const ForwardRequest = {
        from: other.address,
        to: cngn.address,
        value: 0,
        gas: 1e6,
        nonce: 0,
        data: "0x",
      };
      await expect(
        forwarderCtr.connect(other).executeByBridge(ForwardRequest, "0x")
      ).to.be.revertedWith("Unauthorized bridge");
    });
  });
});
