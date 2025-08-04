const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("CngnV2 Meta-Transactions", function () {
  let owner, user, minter;
  let token, admin, forwarder;
  const MINT_AMOUNT = ethers.utils.parseUnits("100", 6);

  beforeEach(async function () {
    [owner, user, minter] = await ethers.getSigners();

    // Deploy Admin2 contract (Operations2)
    const Admin2 = await ethers.getContractFactory("Admin2");
    admin = await upgrades.deployProxy(Admin2, [], {
      initializer: "initialize",
    });
    await admin.deployed();

    // Setup permissions
    if (!(await admin.canMint(minter.address))) {
      await admin.addCanMint(minter.address);
    }
    await admin.addMintAmount(minter.address, MINT_AMOUNT);
    await admin.addCanForward(minter.address); // Required for meta-tx

    // User burn test permissions
    await admin.addCanForward(user.address); // Required for burnByUser meta-tx

    // Deploy Forwarder2 with Admin address
    const Forwarder2 = await ethers.getContractFactory("Forwarder2");
    forwarder = await Forwarder2.deploy(admin.address);
    await forwarder.deployed();

    // Authorize user as bridge (Forwarder uses msg.sender)
    await forwarder.authorizeBridge(user.address);

    // Deploy CngnV2 token
    const CngnV2 = await ethers.getContractFactory("CngnV2");
    token = await upgrades.deployProxy(
      CngnV2,
      [forwarder.address, admin.address],
      { initializer: "initialize" }
    );
    await token.deployed();

    // Mint some tokens to user (via regular mint)
    if (!(await admin.canMint(owner.address))) {
      await admin.addCanMint(owner.address);
    }
    await admin.addMintAmount(owner.address, MINT_AMOUNT);
    await token.connect(owner).mint(MINT_AMOUNT, user.address);
  });

  it("should execute mint() via meta-tx signed by minter", async function () {
    const iface = token.interface;
    const data = iface.encodeFunctionData("mint", [MINT_AMOUNT, user.address]);
    const nonce = await forwarder.getNonce(minter.address);

    const req = {
      from: minter.address,
      to: token.address,
      value: 0,
      gas: 1e6,
      nonce: nonce.toNumber(),
      data,
    };

    const domain = {
      name: "cNGN",
      version: "0.0.1",
      chainId: await minter.getChainId(),
      verifyingContract: forwarder.address,
    };

    const types = {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
    };

    const signature = await minter._signTypedData(domain, types, req);

    const balanceBefore = await token.balanceOf(user.address);

    await expect(
      forwarder.connect(user).executeByBridge(req, signature, {
        gasLimit: 1e6,
      })
    ).to.emit(forwarder, "Executed");

    const balanceAfter = await token.balanceOf(user.address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(MINT_AMOUNT);
  });

  it("should execute burnByUser() via meta-tx signed by user", async function () {
    const iface = token.interface;
    const data = iface.encodeFunctionData("burnByUser", [MINT_AMOUNT]);
    const nonce = await forwarder.getNonce(user.address);

    const req = {
      from: user.address,
      to: token.address,
      value: 0,
      gas: 1e6,
      nonce: nonce.toNumber(),
      data,
    };

    const domain = {
      name: "cNGN",
      version: "0.0.1",
      chainId: await user.getChainId(),
      verifyingContract: forwarder.address,
    };

    const types = {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
    };

    const signature = await user._signTypedData(domain, types, req);

    const balanceBefore = await token.balanceOf(user.address);

    await expect(
      forwarder.connect(user).executeByBridge(req, signature, {
        gasLimit: 1e6,
      })
    ).to.emit(forwarder, "Executed");

    const balanceAfter = await token.balanceOf(user.address);
    expect(balanceBefore.sub(balanceAfter)).to.equal(MINT_AMOUNT);
  });
});
