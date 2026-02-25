// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// EIP-2770: https://eips.ethereum.org/EIPS/eip-2770
// forwarder for extensible meta-transaction forwarding with sequential nonce enforcement.

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IOperations.sol";

contract Forwarder is EIP712, Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    event BridgeAuthorized(address indexed bridgeAddress);
    event BridgeDeauthorized(address indexed bridgeAddress);
    event AdminOperationsAddressUpdated(address indexed newAdminAddress);
    event Executed(address indexed relayer, bool success, bytes returnData);
    event NonceIncremented(address indexed from, uint256 newNonce);

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    bytes32 private constant TYPEHASH =
        keccak256(
            "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
        );

    address public immutable adminOperationsContract;
    mapping(address => bool) public authorizedBridges;
    mapping(bytes32 => bool) public processedTxHashes;
    mapping(address => uint256) private _nonces;

    constructor(address _adminOperationsContract) EIP712("cNGN", "0.0.1") {
        adminOperationsContract = _adminOperationsContract;
    }

    /** @dev Returns the current nonce for an address */
    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    // /** @dev Update admin operations contract address */
    // function updateAdminOperationsAddress(
    //     address newAdmin
    // ) external onlyOwner returns (bool) {
    //     adminOperationsContract = newAdmin;
    //     emit AdminOperationsAddressUpdated(newAdmin);
    //     return true;
    // }

    /** @dev Add a bridge as authorized relayer */
    function authorizeBridge(address bridgeAddress) external onlyOwner {
        authorizedBridges[bridgeAddress] = true;
        emit BridgeAuthorized(bridgeAddress);
    }

    /** @dev Remove a bridge from authorized relayers */
    function deauthorizeBridge(address bridgeAddress) external onlyOwner {
        authorizedBridges[bridgeAddress] = false;
        emit BridgeDeauthorized(bridgeAddress);
    }

    /// @notice Only calls from authorized bridges may use this
    modifier onlyAuthorizedBridge() {
        require(authorizedBridges[msg.sender], "Unauthorized bridge");
        _;
    }

    /** @dev Internal: Prevent replay via unique tx hash */
    function _preventReplay(bytes32 txHash) internal {
        require(!processedTxHashes[txHash], "Replay attack prevented");
        processedTxHashes[txHash] = true;
    }

    /** @dev Verify signature and sequential nonce */
    function verify(
        ForwardRequest calldata req,
        bytes calldata signature
    ) public view returns (bool) {
        // Recover signer
        address signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    TYPEHASH,
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        ).recover(signature);

        // Must match signer and exactly match on-chain nonce
        return (signer == req.from && req.nonce == _nonces[req.from]);
    }

    /**
     * @dev Internal execution path for meta-transactions.
     * Enforces blacklist, sequential nonce, signature validity, and replay protection.
     */
    function _executeTransaction(
        ForwardRequest calldata req,
        bytes calldata signature
    ) internal returns (bool, bytes memory) {
        // Only approved forwarders/bridges
        require(
            IAdmin(adminOperationsContract).canForward(req.from),
            "Forwarder: route not allowed"
        );
        // Relayer blacklist
        require(
            !IAdmin(adminOperationsContract).isBlackListed(_msgSender()),
            "Forwarder: relayer blacklisted"
        );
        // Signer blacklist
        require(
            !IAdmin(adminOperationsContract).isBlackListed(req.from),
            "Forwarder: signer blacklisted"
        );
        // Signature and nonce check
        require(
            verify(req, signature),
            "Forwarder: invalid signature or incorrect nonce"
        );

        // Replay-prevention
        bytes32 txHash = keccak256(
            abi.encode(req.from, req.to, req.value, req.nonce, req.data)
        );
        _preventReplay(txHash);

        // Bump on-chain nonce by exactly one
        _nonces[req.from] = req.nonce + 1;
        emit NonceIncremented(req.from, _nonces[req.from]);

        require(
            gasleft() >= (req.gas * 64) / 63,
            "Insufficient gas for requested execution"
        );
        // Execute underlying call
        (bool success, bytes memory returndata) = req.to.call{
            gas: req.gas,
            value: req.value
        }(abi.encodePacked(req.data, req.from));

        emit Executed(_msgSender(), success, returndata);
        return (success, returndata);
    }

    /** @dev Public entry for owner-based forwarding */
    function execute(
        ForwardRequest calldata req,
        bytes calldata signature
    )
        external
        payable
        onlyOwner
        whenNotPaused
        nonReentrant
        returns (bool, bytes memory)
    {
        return _executeTransaction(req, signature);
    }

    /** @dev Public entry for bridge-based forwarding */
    function executeByBridge(
        ForwardRequest calldata req,
        bytes calldata signature
    )
        external
        payable
        onlyAuthorizedBridge
        whenNotPaused
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

    receive() external payable {}
}
