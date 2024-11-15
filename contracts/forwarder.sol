// SPDX-License-Identifier: MIT
// Further information: https://eips.ethereum.org/EIPS/eip-2770
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol"; // Added ReentrancyGuard for reentrancy protection
import "./IOperations.sol";

/**
 * @title Forwarder Smart Contract
 * @author Pascal Marco Caversaccio, pascal.caversaccio@hotmail.ch
 * @dev Simple forwarder for extensible meta-transaction forwarding.
 * This contract has been updated with security improvements.
 */

contract MinimalForwarder is
    EIP712,
    Ownable,
    Pausable,
    ReentrancyGuard // Implementing ReentrancyGuard here
{
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    address public adminOperationsContract;
    mapping(address => bool) public authorizedBridges; // Track authorized bridge contracts
    mapping(bytes32 => bool) public processedTxHashes; // Prevent replay attacks

    bytes32 public constant _TYPEHASH =
        keccak256(
            "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
        );

    mapping(address => uint256) private _nonces;

    // Constructor
    constructor(
        address _adminOperationsContract
    ) EIP712("MinimalForwarder", "0.0.1") {
        adminOperationsContract = _adminOperationsContract;
    }

    // Admin can update the admin operations address
    function updateAdminOperationsAddress(
        address _newAdmin
    ) public virtual onlyOwner returns (bool) {
        adminOperationsContract = _newAdmin;
        return true;
    }

    // Get the nonce for a given address
    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    // Verify the signature of the ForwardRequest
    function verify(
        ForwardRequest calldata req,
        bytes calldata signature
    ) public view returns (bool) {
        bytes32 messagehash = keccak256(
            abi.encodePacked(
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                req.data
            )
        );
        address signer = messagehash.toEthSignedMessageHash().recover(
            signature
        );

        return ((_nonces[req.from] == req.nonce && signer == req.from));
    }

    // Execute the forward request with additional security checks
    function execute(
        ForwardRequest calldata req,
        bytes calldata signature
    ) public payable onlyOwner nonReentrant returns (bool, bytes memory) {
        // Added nonReentrant modifier
        require(
            IAdmin(adminOperationsContract).canForward(req.from),
            "You are not allowed to use this tx route"
        );
        require(
            !IAdmin(adminOperationsContract).isBlackListed(_msgSender()),
            "Relayer is blacklisted"
        );
        require(
            IAdmin(adminOperationsContract).canMint(req.from),
            "Minter not authorized to sign"
        );
        require(
            verify(req, signature),
            "MinimalForwarder: signature does not match request"
        );
        bytes32 txHash = keccak256(
            abi.encode(
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                req.data
            )
        );
        _preventReplay(txHash); // Prevent replay attacks for this transaction
        _nonces[req.from] = req.nonce + 1;
