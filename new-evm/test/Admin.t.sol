// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Operations2.sol";

contract Admin2Test is Test {
    Admin2 public admin;

    address public owner;
    address public user1;
    address public user2;
    address public trustedContract;

    event AddedBlackList(address indexed _user);
    event RemovedBlackList(address indexed _user);
    event MintAmountAdded(address indexed _user);
    event MintAmountRemoved(address indexed _user);
    event WhitelistedForwarder(address indexed _user);
    event BlackListedForwarder(address indexed _user);
    event WhitelistedMinter(address indexed _user);
    event BlackListedMinter(address indexed _user);
    event WhitelistedContract(address indexed _user);
    event BlackListedContract(address indexed _user);
    event WhitelistedExternalSender(address indexed _user);
    event BlackListedExternalSender(address indexed _user);
    event WhitelistedInternalUser(address indexed _user);
    event BlackListedInternalUser(address indexed _user);

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        trustedContract = makeAddr("trustedContract");

        admin = new Admin2();
        admin.initialize();
    }

    // Test 1: Initialize contract properly
    function test_Initialize() public {
        Admin2 newAdmin = new Admin2();
        newAdmin.initialize();

        assertEq(newAdmin.owner(), address(this));
        assertTrue(newAdmin.canForward(address(this)));
        assertTrue(newAdmin.canMint(address(this)));
    }

    // Test 2: Cannot initialize twice
    function test_CannotInitializeTwice() public {
        vm.expectRevert("Initializable: contract is already initialized");
        admin.initialize();
    }

    // Test 3: Add can mint successfully
    function test_AddCanMint() public {
        vm.expectEmit(true, false, false, false);
        emit WhitelistedMinter(user1);
        bool success = admin.addCanMint(user1);

        assertTrue(success);
        assertTrue(admin.canMint(user1));
    }

    // Test 4: Cannot add same minter twice
    function test_CannotAddSameMinterTwice() public {
        admin.addCanMint(user1);

        vm.expectRevert("User already added as minter");
        admin.addCanMint(user1);
    }

    // Test 5: Cannot add blacklisted user as minter
    function test_CannotAddBlacklistedUserAsMinter() public {
        admin.addBlackList(user1);

        vm.expectRevert("User is blacklisted");
        admin.addCanMint(user1);
    }

    // Test 6: Remove can mint successfully
    function test_RemoveCanMint() public {
        admin.addCanMint(user1);
        admin.addMintAmount(user1, 1000e6);

        vm.expectEmit(true, false, false, false);
        emit BlackListedMinter(user1);
        bool success = admin.removeCanMint(user1);

        assertTrue(success);
        assertFalse(admin.canMint(user1));
        assertEq(admin.mintAmount(user1), 0);
    }

    // Test 7: Cannot remove non-existent minter
    function test_CannotRemoveNonExistentMinter() public {
        vm.expectRevert("User is not a minter");
        admin.removeCanMint(user1);
    }

    // Test 8: Add mint amount successfully
    function test_AddMintAmount() public {
        admin.addCanMint(user1);

        vm.expectEmit(true, false, false, false);
        emit MintAmountAdded(user1);
        bool success = admin.addMintAmount(user1, 1000e6);

        assertTrue(success);
        assertEq(admin.mintAmount(user1), 1000e6);
    }

    // Test 9: Cannot add mint amount to non-minter
    function test_CannotAddMintAmountToNonMinter() public {
        vm.expectRevert();
        admin.addMintAmount(user1, 1000e6);
    }

    // Test 10: Remove mint amount successfully
    function test_RemoveMintAmount() public {
        admin.addCanMint(user1);
        admin.addMintAmount(user1, 1000e6);

        vm.expectEmit(true, false, false, false);
        emit MintAmountRemoved(user1);
        bool success = admin.removeMintAmount(user1);

        assertTrue(success);
        assertEq(admin.mintAmount(user1), 0);
    }

    // Test 11: Whitelist external sender successfully
    function test_WhitelistExternalSender() public {
        vm.expectEmit(true, false, false, false);
        emit WhitelistedExternalSender(user1);
        bool success = admin.whitelistExternalSender(user1);

        assertTrue(success);
        assertTrue(admin.isExternalSenderWhitelisted(user1));
    }

    // Test 12: Cannot whitelist same external sender twice
    function test_CannotWhitelistSameExternalSenderTwice() public {
        admin.whitelistExternalSender(user1);

        vm.expectRevert("User already whitelisted");
        admin.whitelistExternalSender(user1);
    }

    // Test 13: Blacklist external sender successfully
    function test_BlacklistExternalSender() public {
        admin.whitelistExternalSender(user1);

        vm.expectEmit(true, false, false, false);
        emit BlackListedExternalSender(user1);
        bool success = admin.blacklistExternalSender(user1);

        assertTrue(success);
        assertFalse(admin.isExternalSenderWhitelisted(user1));
    }

    // Test 14: Whitelist internal user successfully
    function test_WhitelistInternalUser() public {
        vm.expectEmit(true, false, false, false);
        emit WhitelistedInternalUser(user1);
        bool success = admin.whitelistInternalUser(user1);

        assertTrue(success);
        assertTrue(admin.isInternalUserWhitelisted(user1));
    }

    // Test 15: Blacklist internal user successfully
    function test_BlacklistInternalUser() public {
        admin.whitelistInternalUser(user1);

        vm.expectEmit(true, false, false, false);
        emit BlackListedInternalUser(user1);
        bool success = admin.blacklistInternalUser(user1);

        assertTrue(success);
        assertFalse(admin.isInternalUserWhitelisted(user1));
    }

    // Test 16: Add can forward successfully
    function test_AddCanForward() public {
        vm.expectEmit(true, false, false, false);
        emit WhitelistedForwarder(user1);
        bool success = admin.addCanForward(user1);

        assertTrue(success);
        assertTrue(admin.canForward(user1));
    }

    // Test 17: Add trusted contract successfully
    function test_AddTrustedContract() public {
        vm.expectEmit(true, false, false, false);
        emit WhitelistedContract(trustedContract);
        bool success = admin.addTrustedContract(trustedContract);

        assertTrue(success);
        assertTrue(admin.trustedContract(trustedContract));
    }

    // Test 18: Trusted contract can call protected functions
    function test_TrustedContractCanCallProtectedFunctions() public {
        admin.addTrustedContract(trustedContract);
        admin.addCanMint(user1);

        // Trusted contract removes minter
        vm.prank(trustedContract);
        bool success = admin.removeCanMint(user1);

        assertTrue(success);
        assertFalse(admin.canMint(user1));
    }

    // Test 19: Add and remove from blacklist
    function test_BlacklistManagement() public {
        vm.expectEmit(true, false, false, false);
        emit AddedBlackList(user1);
        admin.addBlackList(user1);

        assertTrue(admin.isBlackListed(user1));

        vm.expectEmit(true, false, false, false);
        emit RemovedBlackList(user1);
        bool success = admin.removeBlackList(user1);

        assertTrue(success);
        assertFalse(admin.isBlackListed(user1));
    }

    // Test 20: Pause and unpause functionality
    function test_PauseUnpause() public {
        // Pause contract
        admin.pause();

        // Try to add minter while paused (should fail)
        vm.expectRevert("Pausable: paused");
        admin.addCanMint(user1);

        // Unpause
        admin.unpause();

        // Should work now
        bool success = admin.addCanMint(user1);
        assertTrue(success);
        assertTrue(admin.canMint(user1));
    }
}
