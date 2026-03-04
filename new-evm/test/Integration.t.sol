// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Cngn3.sol";
import "../src/Operations2.sol";
import "../src/Forwarder.sol";

contract IntegrationTest is Test {
    Cngn3 public cngn;
    Admin2 public admin;
    Forwarder public forwarder;

    address public owner;
    address public minter;
    address public user1;
    address public user2;
    address public internalUser;
    address public externalUser;
    address public bridge;
    uint256 public minterPrivateKey;

    function setUp() public {
        owner = address(this);
        minterPrivateKey = 0xA11CE;
        minter = vm.addr(minterPrivateKey);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        internalUser = makeAddr("internalUser");
        externalUser = makeAddr("externalUser");
        bridge = makeAddr("bridge");

        // Deploy contracts
        admin = new Admin2();
        admin.initialize();

        forwarder = new Forwarder(address(admin));
        forwarder.authorizeBridge(bridge);

        cngn = new Cngn3();
        cngn.initialize(address(forwarder), address(admin));

        // Setup roles
        admin.addTrustedContract(address(cngn));
        admin.addCanForward(minter);
        admin.addCanMint(minter);
        admin.whitelistInternalUser(internalUser);
        admin.whitelistExternalSender(externalUser);
    }

    function _getDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("cNGN")),
                keccak256(bytes("0.0.1")),
                block.chainid,
                address(forwarder)
            )
        );
    }

    function _createSignature(
        Forwarder.ForwardRequest memory req,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
                ),
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _getDomainSeparator(),
                structHash
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // Test 1: Full meta-transaction mint flow
    function test_FullMetaTransactionMintFlow() public {
        admin.addMintAmount(minter, 1000e6);

        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 1000e6, user1);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: minter,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, minterPrivateKey);

        (bool success, ) = forwarder.execute(req, signature);

        assertTrue(success);
        assertEq(cngn.balanceOf(user1), 1000e6);
        assertFalse(admin.canMint(minter)); // Should be revoked
    }

    // Test 2: Meta-transaction fails if admin blocks minter
    function test_MetaTransactionFailsIfAdminBlocksMinter() public {
        admin.addMintAmount(minter, 1000e6);
        admin.removeCanMint(minter);

        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 1000e6, user1);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: minter,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, minterPrivateKey);

        (bool success, ) = forwarder.execute(req, signature);

        assertFalse(success); // Transaction executed but mint failed
        assertEq(cngn.balanceOf(user1), 0);
    }

    // Test 3: Meta-transaction for transfer
    function test_MetaTransactionTransfer() public {
        // First mint tokens
        admin.addMintAmount(minter, 1000e6);
        vm.prank(minter);
        cngn.mint(1000e6, minter);

        // Now transfer via meta-transaction
        bytes memory data = abi.encodeWithSelector(cngn.transfer.selector, user1, 500e6);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: minter,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, minterPrivateKey);

        (bool success, ) = forwarder.execute(req, signature);

        assertTrue(success);
        assertEq(cngn.balanceOf(minter), 500e6);
        assertEq(cngn.balanceOf(user1), 500e6);
    }

    // Test 4: Meta-transaction for burn
    function test_MetaTransactionBurn() public {
        // First mint tokens
        admin.addMintAmount(minter, 1000e6);
        vm.prank(minter);
        cngn.mint(1000e6, minter);

        // Now burn via meta-transaction
        bytes memory data = abi.encodeWithSelector(cngn.burnByUser.selector, 500e6);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: minter,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, minterPrivateKey);

        (bool success, ) = forwarder.execute(req, signature);

        assertTrue(success);
        assertEq(cngn.balanceOf(minter), 500e6);
        assertEq(cngn.totalSupply(), 500e6);
    }

    // Test 5: Blacklist blocks all operations
    function test_BlacklistBlocksAllOperations() public {
        // Mint tokens first
        admin.addMintAmount(minter, 1000e6);
        vm.prank(minter);
        cngn.mint(1000e6, minter);

        // Blacklist minter
        admin.addBlackList(minter);

        // Try to transfer - should fail
        vm.prank(minter);
        vm.expectRevert("Sender is blacklisted");
        cngn.transfer(user1, 100e6);

        // Try to burn - should fail
        vm.prank(minter);
        vm.expectRevert("User is blacklisted");
        cngn.burnByUser(100e6);

        // Try meta-transaction - should fail
        bytes memory data = abi.encodeWithSelector(cngn.transfer.selector, user1, 100e6);
        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: minter,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });
        bytes memory signature = _createSignature(req, minterPrivateKey);

        vm.expectRevert("Forwarder: signer blacklisted");
        forwarder.execute(req, signature);
    }

    // Test 6: Redemption flow with meta-transaction
    function test_RedemptionFlowWithMetaTransaction() public {
        // Setup external and internal users
        admin.addCanMint(externalUser);
        admin.addMintAmount(externalUser, 1000e6);

        // Mint to external user
        vm.prank(externalUser);
        cngn.mint(1000e6, externalUser);

        // Transfer to internal user (should burn)
        vm.prank(externalUser);
        cngn.transfer(internalUser, 500e6);

        assertEq(cngn.balanceOf(externalUser), 500e6);
        assertEq(cngn.balanceOf(internalUser), 0); // Burned
        assertEq(cngn.totalSupply(), 500e6);
    }

    // Test 7: Admin can destroy blacklisted funds
    function test_AdminCanDestroyBlacklistedFunds() public {
        // Mint tokens to user
        admin.addMintAmount(minter, 1000e6);
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // Blacklist user
        admin.addBlackList(user1);

        // Destroy funds
        uint256 balanceBefore = cngn.balanceOf(user1);
        cngn.destroyBlackFunds(user1);

        assertEq(cngn.balanceOf(user1), 0);
        assertEq(cngn.totalSupply(), 1000e6 - balanceBefore);
    }

    // Test 8: Bridge can execute meta-transactions
    function test_BridgeCanExecuteMetaTransactions() public {
        admin.addMintAmount(minter, 1000e6);

        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 1000e6, user1);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: minter,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, minterPrivateKey);

        vm.prank(bridge);
        (bool success, ) = forwarder.executeByBridge(req, signature);

        assertTrue(success);
        assertEq(cngn.balanceOf(user1), 1000e6);
    }

    // Test 9: Nonce management prevents replay across multiple transactions
    function test_NonceManagementPreventsReplay() public {
        admin.addMintAmount(minter, 100e6);

        // First transaction
        bytes memory data1 = abi.encodeWithSelector(cngn.mint.selector, 100e6, user1);
        Forwarder.ForwardRequest memory req1 = Forwarder.ForwardRequest({
            from: minter,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data1
        });
        bytes memory sig1 = _createSignature(req1, minterPrivateKey);
        forwarder.execute(req1, sig1);

        // Try to replay - should fail
        vm.expectRevert("Forwarder: invalid signature or incorrect nonce");
        forwarder.execute(req1, sig1);

        // Second transaction with correct nonce
        admin.addCanMint(minter); 
        admin.addMintAmount(minter, 200e6);
        bytes memory data2 = abi.encodeWithSelector(cngn.mint.selector, 200e6, user2);
        Forwarder.ForwardRequest memory req2 = Forwarder.ForwardRequest({
            from: minter,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 1,
            data: data2
        });
        bytes memory sig2 = _createSignature(req2, minterPrivateKey);
        (bool success, ) = forwarder.execute(req2, sig2);

        assertTrue(success);
        assertEq(cngn.balanceOf(user1), 100e6);
        assertEq(cngn.balanceOf(user2), 200e6);
    }

    // Test 10: Pause cascades through all contracts
    function test_PauseCascades() public {
        // Pause admin
        admin.pause();

        // Admin operations should fail
        vm.expectRevert("Pausable: paused");
        admin.addCanMint(user1);

        // Unpause admin
        admin.unpause();

        // Pause cngn
        cngn.pause();

        // Minting should fail
        admin.addMintAmount(minter, 1000e6);
        vm.prank(minter);
        vm.expectRevert("Pausable: paused");
        cngn.mint(1000e6, user1);

        // Unpause cngn
        cngn.unpause();

        // Pause forwarder
        forwarder.pause();

        // Meta-transactions should fail
        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 1000e6, user1);
        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: minter,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });
        bytes memory signature = _createSignature(req, minterPrivateKey);

        vm.expectRevert("Pausable: paused");
        forwarder.execute(req, signature);
    }

 

    // Test 12: Complex workflow - mint, transfer, approve, transferFrom
    function test_ComplexWorkflow() public {
        // Mint to user1
        admin.addMintAmount(minter, 1000e6);
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // User1 transfers to user2
        vm.prank(user1);
        cngn.transfer(user2, 400e6);

        // User2 approves minter
        vm.prank(user2);
        cngn.approve(minter, 200e6);

        // Minter transfers from user2 to themselves
        vm.prank(minter);
        cngn.transferFrom(user2, minter, 200e6);

        assertEq(cngn.balanceOf(user1), 600e6);
        assertEq(cngn.balanceOf(user2), 200e6);
        assertEq(cngn.balanceOf(minter), 200e6);
    }

    // Test 13: Internal user cannot receive regular transfers (only redemption)
    function test_InternalUserCanOnlyReceiveRedemption() public {
        // Mint to user1
        admin.addMintAmount(minter, 1000e6);
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // User1 tries to send to internal user (not whitelisted as external)
        vm.prank(user1);
        cngn.transfer(internalUser, 100e6);

        // Tokens should be received normally (not burned)
        assertEq(cngn.balanceOf(internalUser), 100e6);
    }

    // Test 14: Multiple minters can mint independently
    function test_MultipleMinters() public {
        address minter2 = makeAddr("minter2");


        admin.addMintAmount(minter, 500e6);

        admin.addCanMint(minter2);
        admin.addMintAmount(minter2, 300e6);

        // Minter1 mints
        vm.prank(minter);
        cngn.mint(500e6, user1);

        // Minter2 mints
        vm.prank(minter2);
        cngn.mint(300e6, user2);

        assertEq(cngn.balanceOf(user1), 500e6);
        assertEq(cngn.balanceOf(user2), 300e6);
        assertEq(cngn.totalSupply(), 800e6);
    }

    // Test 15: Remove and re-add forwarder
    function test_RemoveAndReAddForwarder() public {
        // Remove forwarder ability
        admin.removeCanForward(minter);

        // Try to execute meta-transaction - should fail
        admin.addMintAmount(minter, 1000e6);
        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 1000e6, user1);
        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: minter,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });
        bytes memory signature = _createSignature(req, minterPrivateKey);

        vm.expectRevert("Forwarder: route not allowed");
        forwarder.execute(req, signature);

        // Re-add forwarder ability
        admin.addCanForward(minter);

        // Should work now
        (bool success, ) = forwarder.execute(req, signature);
        assertTrue(success);
    }

    // Test 16: Trusted contract can manage admin operations
    function test_TrustedContractCanManageAdminOperations() public {
        address testContract = makeAddr("testContract");
        admin.addTrustedContract(testContract);

        // Trusted contract adds minter
        vm.prank(testContract);
        admin.addCanMint(user1);

        assertTrue(admin.canMint(user1));

        // Trusted contract removes minter
        vm.prank(testContract);
        admin.removeCanMint(user1);

        assertFalse(admin.canMint(user1));
    }

    // Test 17: Forwarder with ether value (if needed for gas)
    function test_ForwarderWithEtherValue() public {
        admin.addMintAmount(minter, 1000e6);

        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 1000e6, user1);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: minter,
            to: address(cngn),
            value: 0.1 ether, // Include ether value
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, minterPrivateKey);

        // Send with value
        (bool success, ) = forwarder.execute{value: 0.1 ether}(req, signature);

        assertFalse(success);
        assertEq(cngn.balanceOf(user1), 0);
    }

    // Test 18: Whitelist and blacklist external sender
    function test_WhitelistBlacklistExternalSender() public {
        // External user is already whitelisted in setup
        assertTrue(admin.isExternalSenderWhitelisted(externalUser));

        // Blacklist
        admin.blacklistExternalSender(externalUser);
        assertFalse(admin.isExternalSenderWhitelisted(externalUser));

        // Re-whitelist
        admin.whitelistExternalSender(externalUser);
        assertTrue(admin.isExternalSenderWhitelisted(externalUser));
    }

    // Test 19: Mint amount management
    function test_MintAmountManagement() public {
        admin.addMintAmount(minter, 1000e6);
        assertEq(admin.mintAmount(minter), 1000e6);

        // Update mint amount
        admin.addMintAmount(minter, 2000e6);
        assertEq(admin.mintAmount(minter), 2000e6);

        // Remove mint amount
        admin.removeMintAmount(minter);
        assertEq(admin.mintAmount(minter), 0);
    }

    // Test 20: End-to-end stress test with multiple operations
    function test_EndToEndStressTest() public {
        // Setup multiple users
        address user3 = makeAddr("user3");
        address user4 = makeAddr("user4");

        // Mint to multiple users
        admin.addMintAmount(minter, 500e6);
        vm.prank(minter);
        cngn.mint(500e6, user1);

        admin.addCanMint(user2);
        admin.addMintAmount(user2, 300e6);
        vm.prank(user2);
        cngn.mint(300e6, user2);

        // Transfers
        vm.prank(user1);
        cngn.transfer(user3, 200e6);

        vm.prank(user2);
        cngn.transfer(user4, 100e6);

        // Approvals and transferFrom
        vm.prank(user3);
        cngn.approve(user4, 50e6);

        vm.prank(user4);
        cngn.transferFrom(user3, user4, 50e6);

        // Burns
        vm.prank(user1);
        cngn.burnByUser(100e6);

        // Verify final balances
        assertEq(cngn.balanceOf(user1), 200e6); // 500 - 200 - 100
        assertEq(cngn.balanceOf(user2), 200e6); // 300 - 100
        assertEq(cngn.balanceOf(user3), 150e6); // 200 - 50
        assertEq(cngn.balanceOf(user4), 150e6); // 100 + 50
        assertEq(cngn.totalSupply(), 700e6); // 800 - 100 burned
    }
}
