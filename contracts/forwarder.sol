// SPDX-License-Identifier: MIT
// Further information: https://eips.ethereum.org/EIPS/eip-2770
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IOperations.sol";

// Declare events
event BridgeAuthorized(address indexed bridgeAddress);
event BridgeDeauthorized(address indexed bridgeAddress);
event AdminOperationsAddressUpdated(address indexed newAdminAddress);


/**
 * @title Forwarder Smart Contract
 * @dev Simple forwarder for extensible meta-transaction forwarding.
 * This contract has been updated with security improvements.
 */
contract MinimalForwarder is EIP712, Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 nonce;
        bytes data;
    }

    address public adminOperationsContract;
    mapping(address => bool) public authorizedBridges; // Track authorized bridge contracts
    mapping(bytes32 => bool) public processedTxHashes; // Prevent replay attacks

    bytes32 public constant _TYPEHASH =
        keccak256(
            "ForwardRequest(address from,address to,uint256 value,uint256 nonce,bytes data)"
        );

    mapping(address => uint256) private _nonces;

    constructor(
        address _adminOperationsContract
    ) EIP712("MinimalForwarder", "0.0.1") {
        adminOperationsContract = _adminOperationsContract;
    }

    function updateAdminOperationsAddress(
        address _newAdmin
    ) public virtual onlyOwner returns (bool) {
        adminOperationsContract = _newAdmin;
        emit AdminOperationsAddressUpdated(_newAdmin);  // Emit event
        return true;
    }

    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    function verify(
        ForwardRequest calldata req,
        bytes calldata signature
    ) public view returns (bool) {
        bytes32 messagehash = keccak256(
            abi.encodePacked(req.from, req.to, req.value, req.nonce, req.data)
        );
        address signer = messagehash.toEthSignedMessageHash().recover(
            signature
        );

        return ((_nonces[req.from] == req.nonce && signer == req.from));
    }

    function _executeTransaction(
        ForwardRequest calldata req,
        bytes calldata signature
    ) private returns (bool, bytes memory) {
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
            abi.encode(req.from, req.to, req.value, req.nonce, req.data)
        );
        _preventReplay(txHash);
        _nonces[req.from] = req.nonce + 1;

        (bool success, bytes memory returndata) = req.to.call{value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        return (success, returndata);
    }

    function execute(
        ForwardRequest calldata req,
        bytes calldata signature
    ) public payable onlyOwner nonReentrant returns (bool, bytes memory) {
        return _executeTransaction(req, signature);
    }

    function executeByBridge(
        ForwardRequest calldata req,
        bytes calldata signature
    )
        public
        payable
        onlyAuthorizedBridge
        nonReentrant
        returns (bool, bytes memory)
    {
        return _executeTransaction(req, signature);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function authorizeBridge(address bridgeAddress) external onlyOwner {
        authorizedBridges[bridgeAddress] = true;
        emit BridgeAuthorized(bridgeAddress);  // Emit event
    }

    function deauthorizeBridge(address bridgeAddress) external onlyOwner {
        authorizedBridges[bridgeAddress] = false;
        emit BridgeDeauthorized(bridgeAddress);  // Emit event
    }

    modifier onlyAuthorizedBridge() {
        require(authorizedBridges[msg.sender], "Unauthorized bridge");
        _;
    }

    function _preventReplay(bytes32 txHash) internal {
        require(!processedTxHashes[txHash], "Replay attack prevented");
        processedTxHashes[txHash] = true;
    }

    modifier onlyAdmin() {
        require(msg.sender == adminOperationsContract, "Not an admin");
        _;
    }

    receive() external payable {}
}
