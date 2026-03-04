// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "forge-std/Test.sol";
import "../src/Cngn3.sol";
import "../src/Operations2.sol";
import "../src/Forwarder.sol";

contract Cngn3Test is Test {
    Cngn3 public cngn;
    Admin2 public admin;
    Forwarder public forwarder;

    address public owner;
    address public user1;
    address public user2;
    address public minter;
    address public blacklistedUser;
    address public internalUser;
    address public externalUser;

    event DestroyedBlackFunds(address indexed user, uint256 amount);
    event UpdateAdminOperations(
        address indexed oldAddress,
        address indexed newAddress
    );
    event UpdateForwarderContract(
        address indexed oldAddress,
        address indexed newAddress
    );

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        minter = makeAddr("minter");
        blacklistedUser = makeAddr("blacklistedUser");
        internalUser = makeAddr("internalUser");
        externalUser = makeAddr("externalUser");

        // Deploy Admin contract
        admin = new Admin2();
        admin.initialize();

        // Deploy Forwarder contract
        forwarder = new Forwarder(address(admin));

        // Deploy Cngn3 contract
        cngn = new Cngn3();
        cngn.initialize(address(forwarder), address(admin));

        // Setup roles
        admin.addTrustedContract(address(cngn));
        admin.addCanMint(minter);
        admin.addMintAmount(minter, 1000e6);
        admin.whitelistInternalUser(internalUser);
        admin.whitelistExternalSender(externalUser);
    }

    // Test 1: Initialize contract properly
    function test_Initialize() public {
        Cngn3 newCngn = new Cngn3();
        Admin2 newAdmin = new Admin2();
        newAdmin.initialize();
        Forwarder newForwarder = new Forwarder(address(newAdmin));

        newCngn.initialize(address(newForwarder), address(newAdmin));

        assertEq(newCngn.name(), "cNGN");
        assertEq(newCngn.symbol(), "cNGN");
        assertEq(newCngn.decimals(), 6);
        assertEq(newCngn.owner(), address(this));
    }

    // Test 2: Cannot initialize twice
    function test_CannotInitializeTwice() public {
        vm.expectRevert("Initializable: contract is already initialized");
        cngn.initialize(address(forwarder), address(admin));
    }

    // Test 3: Decimals returns 6
    function test_Decimals() public view {
        assertEq(cngn.decimals(), 6);
    }

    // Test 4: Mint tokens successfully
    function test_Mint() public {
        vm.prank(minter);
        bool success = cngn.mint(1000e6, user1);

        assertTrue(success);
        assertEq(cngn.balanceOf(user1), 1000e6);
        assertEq(cngn.totalSupply(), 1000e6);
    }

    // Test 5: Mint fails if not authorized
    function test_MintFailsIfNotAuthorized() public {
        vm.prank(user1);
        vm.expectRevert("Minter not authorized to sign");
        cngn.mint(100e6, user2);
    }

    // Test 6: Mint fails if amount doesn't match
    function test_MintFailsIfAmountMismatch() public {
        vm.prank(minter);
        vm.expectRevert("Attempting to mint more than allowed");
        cngn.mint(500e6, user1); // Trying to mint 500 instead of 1000
    }

    // Test 7: Mint revokes authorization after successful mint
    function test_MintRevokesAuthorization() public {
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // Try to mint again
        vm.prank(minter);
        vm.expectRevert("Minter not authorized to sign");
        cngn.mint(1000e6, user1);
    }

    // Test 8: Mint fails if minter is blacklisted
    function test_MintFailsIfMinterBlacklisted() public {
        admin.addBlackList(minter);

        vm.prank(minter);
        vm.expectRevert("Signer is blacklisted");
        cngn.mint(1000e6, user1);
    }

    // Test 9: Mint fails if receiver is blacklisted
    function test_MintFailsIfReceiverBlacklisted() public {
        admin.addBlackList(user1);

        vm.prank(minter);
        vm.expectRevert("receiver is blacklisted");
        cngn.mint(1000e6, user1);
    }

    // Test 10: Transfer tokens successfully
    function test_Transfer() public {
        // Mint tokens to user1
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // Transfer from user1 to user2
        vm.prank(user1);
        bool success = cngn.transfer(user2, 500e6);

        assertTrue(success);
        assertEq(cngn.balanceOf(user1), 500e6);
        assertEq(cngn.balanceOf(user2), 500e6);
    }

    // Test 11: Transfer fails if sender is blacklisted
    function test_TransferFailsIfSenderBlacklisted() public {
        // Mint tokens to user1
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // Blacklist user1
        admin.addBlackList(user1);

        // Try to transfer
        vm.prank(user1);
        vm.expectRevert("Sender is blacklisted");
        cngn.transfer(user2, 500e6);
    }

    // Test 12: Transfer fails if recipient is blacklisted
    function test_TransferFailsIfRecipientBlacklisted() public {
        // Mint tokens to user1
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // Blacklist user2
        admin.addBlackList(user2);

        // Try to transfer
        vm.prank(user1);
        vm.expectRevert("Recipient is blacklisted");
        cngn.transfer(user2, 500e6);
    }

    // Test 13: Redemption flow - external sender to internal user burns tokens
    function test_RedemptionFlow() public {
        // Mint tokens to external user
        admin.addCanMint(externalUser);
        admin.addMintAmount(externalUser, 1000e6);
        vm.prank(externalUser);
        cngn.mint(1000e6, externalUser);

        // Transfer from external to internal (should burn)
        vm.prank(externalUser);
        cngn.transfer(internalUser, 500e6);

        // Both should have 0 balance (tokens were burned)
        assertEq(cngn.balanceOf(externalUser), 500e6);
        assertEq(cngn.balanceOf(internalUser), 0);
        assertEq(cngn.totalSupply(), 500e6); // Total supply reduced by burn
    }

    // Test 14: TransferFrom works correctly
    function test_TransferFrom() public {
        // Mint tokens to user1
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // User1 approves user2 to spend
        vm.prank(user1);
        cngn.approve(user2, 500e6);

        // User2 transfers from user1 to themselves
        vm.prank(user2);
        bool success = cngn.transferFrom(user1, user2, 500e6);

        assertTrue(success);
        assertEq(cngn.balanceOf(user1), 500e6);
        assertEq(cngn.balanceOf(user2), 500e6);
    }

    // Test 15: TransferFrom fails if spender is blacklisted
    function test_TransferFromFailsIfSpenderBlacklisted() public {
        // Mint tokens to user1
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // User1 approves user2
        vm.prank(user1);
        cngn.approve(user2, 500e6);

        // Blacklist user2
        admin.addBlackList(user2);

        // Try to transfer
        vm.prank(user2);
        vm.expectRevert("Spender is blacklisted");
        cngn.transferFrom(user1, user2, 500e6);
    }

    // Test 16: BurnByUser works correctly
    function test_BurnByUser() public {
        // Mint tokens to user1
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // User1 burns their tokens
        vm.prank(user1);
        bool success = cngn.burnByUser(500e6);

        assertTrue(success);
        assertEq(cngn.balanceOf(user1), 500e6);
        assertEq(cngn.totalSupply(), 500e6);
    }

    // Test 17: BurnByUser fails if user is blacklisted
    function test_BurnByUserFailsIfBlacklisted() public {
        // Mint tokens to user1
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // Blacklist user1
        admin.addBlackList(user1);

        // Try to burn
        vm.prank(user1);
        vm.expectRevert("User is blacklisted");
        cngn.burnByUser(500e6);
    }

    // Test 18: Pause and unpause functionality
    function test_PauseUnpause() public {
        // Pause contract
        bool paused = cngn.pause();
        assertTrue(paused);

        // Mint tokens to user1 (should fail)
        vm.prank(minter);
        vm.expectRevert("Pausable: paused");
        cngn.mint(1000e6, user1);

        // Try to transfer (should fail)
        vm.prank(user1);
        vm.expectRevert("Pausable: paused");
        cngn.transfer(user2, 500e6);

        // Unpause
        bool unpaused = cngn.unpause();
        assertTrue(unpaused);
        // Mint tokens to user1 (should now pass)
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // Transfer should work now
        vm.prank(user1);
        cngn.transfer(user2, 500e6);
        assertEq(cngn.balanceOf(user2), 500e6);
    }

    // Test 19: DestroyBlackFunds works correctly
    function test_DestroyBlackFunds() public {
        // Mint tokens to user1
        vm.prank(minter);
        cngn.mint(1000e6, user1);

        // Blacklist user1
        admin.addBlackList(user1);

        // Destroy funds
        vm.expectEmit(true, false, false, true);
        emit DestroyedBlackFunds(user1, 1000e6);
        bool success = cngn.destroyBlackFunds(user1);

        assertTrue(success);
        assertEq(cngn.balanceOf(user1), 0);
        assertEq(cngn.totalSupply(), 0);
    }

    // Test 20: Update admin operations and forwarder contracts
    function test_UpdateContracts() public {
        Admin2 newAdmin = new Admin2();
        newAdmin.initialize();
        Forwarder newForwarder = new Forwarder(address(newAdmin));

        // Update forwarder
        vm.expectEmit(true, true, false, false);
        emit UpdateForwarderContract(address(forwarder), address(newForwarder));
        bool forwarderUpdated = cngn.updateForwarderContract(
            address(newForwarder)
        );
        assertTrue(forwarderUpdated);
    }
}
