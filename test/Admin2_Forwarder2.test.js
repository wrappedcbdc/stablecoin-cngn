const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Admin2 Upgradeable", function () {
  let Admin2, adminProxy, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    Admin2 = await ethers.getContractFactory("Admin2");
    adminProxy = await upgrades.deployProxy(Admin2, [], {
      initializer: "initialize",
    });
    await adminProxy.deployed();
  });

  it("should set deployer as owner and initial roles", async function () {
    expect(await adminProxy.owner()).to.equal(owner.address);
    expect(await adminProxy.canForward(owner.address)).to.be.true;
    expect(await adminProxy.canMint(owner.address)).to.be.true;
  });

  it("should add and remove minter correctly", async function () {
    await adminProxy.addCanMint(addr1.address);
    expect(await adminProxy.canMint(addr1.address)).to.be.true;
    await adminProxy.removeCanMint(addr1.address);
    expect(await adminProxy.canMint(addr1.address)).to.be.false;
  });

  it("should set and clear mint amount", async function () {
    await adminProxy.addCanMint(addr1.address);
    await adminProxy.addMintAmount(addr1.address, 100);
    expect(await adminProxy.mintAmount(addr1.address)).to.equal(100);
    await adminProxy.removeMintAmount(addr1.address);
    expect(await adminProxy.mintAmount(addr1.address)).to.equal(0);
  });

  it("should whitelist and blacklist external sender", async function () {
    await adminProxy.whitelistExternalSender(addr1.address);
    expect(await adminProxy.isExternalSenderWhitelisted(addr1.address)).to.be
      .true;
    await adminProxy.blacklistExternalSender(addr1.address);
    expect(await adminProxy.isExternalSenderWhitelisted(addr1.address)).to.be
      .false;
  });

  it("should pause and unpause contract", async function () {
    await adminProxy.pause();
    await expect(adminProxy.addCanMint(addr1.address)).to.be.revertedWith(
      "Pausable: paused"
    );
    await adminProxy.unpause();
    await expect(adminProxy.addCanMint(addr1.address)).to.not.be.reverted;
  });
});

describe("Forwarder2 Meta-Transactions", function () {
  let Forwarder2, forwarder, Admin2, adminProxy, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    // Deploy Admin2
    Admin2 = await ethers.getContractFactory("Admin2");
    adminProxy = await upgrades.deployProxy(Admin2, [], {
      initializer: "initialize",
    });

    // Grant permission for forwarding
    await adminProxy.addTrustedContract(addr1.address);

    // Deploy Forwarder2 with adminProxy address
    Forwarder2 = await ethers.getContractFactory("Forwarder2");
    forwarder = await Forwarder2.deploy(adminProxy.address);
    await forwarder.deployed();

    // Authorize addr1 as bridge
    await forwarder.authorizeBridge(addr1.address);
  });

  it("should execute meta-transaction via owner", async function () {
    const iface = adminProxy.interface;
    const data = iface.encodeFunctionData("pause");
    const nonce = await forwarder.getNonce(owner.address);

    const req = {
      from: owner.address,
      to: adminProxy.address,
      value: 0,
      gas: 1e6,
      nonce: nonce.toNumber(),
      data,
    };

    const domain = {
      name: "cNGN",
      version: "0.0.1",
      chainId: await owner.getChainId(),
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

    const signature = await owner._signTypedData(domain, types, req);

    // Corrected: Expect the event directly on the Promise
    await expect(
      forwarder.connect(owner).execute(req, signature, { gasLimit: 1e6 })
    ).to.emit(forwarder, "Executed");

    // Ensure Admin2 is now paused by asserting pause effect
    await expect(adminProxy.addCanMint(addr1.address)).to.be.revertedWith(
      "Pausable: paused"
    );
  });
});
