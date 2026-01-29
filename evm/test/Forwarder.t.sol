// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Forwarder.sol";
import "../src/Operations2.sol";
import "../src/Cngn3.sol";

contract ForwarderTest is Test {
    Forwarder public forwarder;
    Admin2 public admin;
    Cngn3 public cngn;

    address public owner;
    address public signer;
    address public relayer;
    address public bridge;
    address public recipient;
    uint256 public signerPrivateKey;

    event BridgeAuthorized(address indexed bridgeAddress);
    event BridgeDeauthorized(address indexed bridgeAddress);
    event AdminOperationsAddressUpdated(address indexed newAdminAddress);
    event Executed(address indexed relayer, bool success, bytes returnData);
    event NonceIncremented(address indexed from, uint256 newNonce);

    function setUp() public {
        owner = address(this);
        signerPrivateKey = 0xA11CE;
        signer = vm.addr(signerPrivateKey);
        relayer = makeAddr("relayer");
        bridge = makeAddr("bridge");
        recipient = makeAddr("recipient");

        // Deploy Admin
        admin = new Admin2();
        admin.initialize();

        // Deploy Forwarder
        forwarder = new Forwarder(address(admin));

        // Deploy Cngn3
        cngn = new Cngn3();
        cngn.initialize(address(forwarder), address(admin));

        // Setup roles
        admin.addTrustedContract(address(cngn));
        admin.addCanForward(signer);
        admin.addCanMint(signer);
        admin.addMintAmount(signer, 1000e6);

        // Authorize bridge
        forwarder.authorizeBridge(bridge);
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

    // Test 1: Get nonce returns correct value
    function test_GetNonce() public view {
        assertEq(forwarder.getNonce(signer), 0);
    }

    // Test 2: Authorize bridge successfully
    function test_AuthorizeBridge() public {
        address newBridge = makeAddr("newBridge");

        vm.expectEmit(true, false, false, false);
        emit BridgeAuthorized(newBridge);
        forwarder.authorizeBridge(newBridge);

        assertTrue(forwarder.authorizedBridges(newBridge));
    }

    // Test 3: Deauthorize bridge successfully
    function test_DeauthorizeBridge() public {
        vm.expectEmit(true, false, false, false);
        emit BridgeDeauthorized(bridge);
        forwarder.deauthorizeBridge(bridge);

        assertFalse(forwarder.authorizedBridges(bridge));
    }

 

    // Test 5: Verify valid signature and nonce
    function test_VerifyValidSignature() public view {
        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 100e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, signerPrivateKey);

        assertTrue(forwarder.verify(req, signature));
    }

    // Test 6: Verify fails with wrong nonce
    function test_VerifyFailsWithWrongNonce() public view {
        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 100e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 1, // Wrong nonce (should be 0)
            data: data
        });

        bytes memory signature = _createSignature(req, signerPrivateKey);

        assertFalse(forwarder.verify(req, signature));
    }

    // Test 7: Verify fails with wrong signer
    function test_VerifyFailsWithWrongSigner() public view {
        uint256 wrongPrivateKey = 0xB0B;
       // address wrongSigner = vm.addr(wrongPrivateKey);

        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 100e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer, // Claims to be signer
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, wrongPrivateKey); // But signed by wrong key

        assertFalse(forwarder.verify(req, signature));
    }

    // Test 8: Execute meta-transaction successfully by owner
    function test_ExecuteByOwner() public {
        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 1000e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, signerPrivateKey);

        (bool success, ) = forwarder.execute(req, signature);

        assertTrue(success);
        assertEq(cngn.balanceOf(recipient), 1000e6);
        assertEq(forwarder.getNonce(signer), 1);
    }

    // Test 9: Execute meta-transaction successfully by bridge
    function test_ExecuteByBridge() public {
        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 1000e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, signerPrivateKey);

        vm.prank(bridge);
        (bool success, ) = forwarder.executeByBridge(req, signature);

        assertTrue(success);
        assertEq(cngn.balanceOf(recipient), 1000e6);
        assertEq(forwarder.getNonce(signer), 1);
    }

    // Test 10: Execute fails with unauthorized bridge
    function test_ExecuteFailsWithUnauthorizedBridge() public {
        address unauthorizedBridge = makeAddr("unauthorizedBridge");
        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 100e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, signerPrivateKey);

        vm.prank(unauthorizedBridge);
        vm.expectRevert("Unauthorized bridge");
        forwarder.executeByBridge(req, signature);
    }

    // Test 11: Execute fails if signer not allowed to forward
    function test_ExecuteFailsIfSignerNotAllowedToForward() public {
        address notAllowed = makeAddr("notAllowed");
        uint256 notAllowedKey = 0xBAD;
        notAllowed = vm.addr(notAllowedKey);

        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 100e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: notAllowed,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, notAllowedKey);

        vm.expectRevert("Forwarder: route not allowed");
        forwarder.execute(req, signature);
    }

    // Test 12: Execute fails if relayer is blacklisted
    function test_ExecuteFailsIfRelayerBlacklisted() public {
        admin.addBlackList(owner);

        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 100e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, signerPrivateKey);

        vm.expectRevert("Forwarder: relayer blacklisted");
        forwarder.execute(req, signature);
    }

    // Test 13: Execute fails if signer is blacklisted
    function test_ExecuteFailsIfSignerBlacklisted() public {
        admin.addBlackList(signer);

        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 100e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, signerPrivateKey);

        vm.expectRevert("Forwarder: signer blacklisted");
        forwarder.execute(req, signature);
    }

    // Test 14: Execute fails with invalid signature
    function test_ExecuteFailsWithInvalidSignature() public {
        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 100e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory invalidSignature = abi.encodePacked(bytes32(0), bytes32(0), uint8(27));

        vm.expectRevert("ECDSA: invalid signature");
        forwarder.execute(req, invalidSignature);
    }

    // Test 15: Execute fails with replay attack
    function test_ExecuteFailsWithReplayAttack() public {
        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 100e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, signerPrivateKey);

        // Execute once
        forwarder.execute(req, signature);

        // Try to replay - should fail due to nonce increment
        vm.expectRevert("Forwarder: invalid signature or incorrect nonce");
        forwarder.execute(req, signature);
    }

    // Test 16: Execute increments nonce correctly
    function test_ExecuteIncrementsNonce() public {
        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 100e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, signerPrivateKey);

        vm.expectEmit(true, false, false, true);
        emit NonceIncremented(signer, 1);
        forwarder.execute(req, signature);

        assertEq(forwarder.getNonce(signer), 1);
    }

    // Test 17: Multiple sequential transactions work correctly
    function test_MultipleSequentialTransactions() public {
        // First transaction
        bytes memory data1 = abi.encodeWithSelector(cngn.mint.selector, 1000e6, recipient);
        Forwarder.ForwardRequest memory req1 = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data1
        });
        bytes memory sig1 = _createSignature(req1, signerPrivateKey);
        forwarder.execute(req1, sig1);

        // Second transaction
        admin.addCanMint(signer);  
        admin.addMintAmount(signer, 200e6);
        bytes memory data2 = abi.encodeWithSelector(cngn.mint.selector, 200e6, recipient);
        Forwarder.ForwardRequest memory req2 = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 1, // Incremented nonce
            data: data2
        });
        bytes memory sig2 = _createSignature(req2, signerPrivateKey);
        forwarder.execute(req2, sig2);

        assertEq(cngn.balanceOf(recipient), 1200e6);
        assertEq(forwarder.getNonce(signer), 2);
    }

    // Test 18: Pause and unpause functionality
    function test_PauseUnpause() public {
        // Pause
        forwarder.pause();

        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 1000e6, recipient);
        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });
        bytes memory signature = _createSignature(req, signerPrivateKey);

        // Should fail while paused
        vm.expectRevert("Pausable: paused");
        forwarder.execute(req, signature);

        // Unpause
        forwarder.unpause();

        // Should work now
        (bool success, ) = forwarder.execute(req, signature);
        assertTrue(success);
    }

    // Test 19: Only owner can pause/unpause
    function test_OnlyOwnerCanPauseUnpause() public {
        vm.prank(relayer);
        vm.expectRevert("Ownable: caller is not the owner");
        forwarder.pause();

        vm.prank(relayer);
        vm.expectRevert("Ownable: caller is not the owner");
        forwarder.unpause();
    }

    // Test 20: Execute emits correct event
    function test_ExecuteEmitsEvent() public {
        bytes memory data = abi.encodeWithSelector(cngn.mint.selector, 100e6, recipient);

        Forwarder.ForwardRequest memory req = Forwarder.ForwardRequest({
            from: signer,
            to: address(cngn),
            value: 0,
            gas: 1000000,
            nonce: 0,
            data: data
        });

        bytes memory signature = _createSignature(req, signerPrivateKey);

        vm.expectEmit(true, false, false, false);
        emit Executed(owner, true, "");
        forwarder.execute(req, signature);
    }
}
