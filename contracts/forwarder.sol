// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./IOperations.sol";

/**
 * @title Forwarder
 * @dev Transparent-upgradeable proxy implementation of an ERC-2771 meta-transaction forwarder.
 *      Uses OpenZeppelin’s EIP-712 base, plus nonce-based replay protection.
 */
contract Forwarder is
    Initializable,
    EIP712Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using ECDSA for bytes32;

    /// @notice Emitted when a bridge address is authorized or deauthorized
    event BridgeAuthorized(address indexed bridgeAddress);
    event BridgeDeauthorized(address indexed bridgeAddress);

    /// @notice Emitted after attempting to execute a forwarded request
    event Executed(bool indexed success, uint256 nonce, bytes returnData);

    /// @notice Emitted when the admin-operations contract is updated
    event AdminOperationsAddressUpdated(address indexed newAdminAddress);

    /// @dev Mapping of “from address” → current nonce
    mapping(address => uint256) private _nonces;

    /// @dev Set of bridges that are allowed to call `executeByBridge(...)`
    mapping(address => bool) public authorizedBridges;

    /// @dev Tracks which transaction hashes have already been processed (replay protection)
    mapping(bytes32 => bool) public processedTxHashes;

    /// @dev The admin-operations contract (for blacklist/whitelist/canForward checks)
    address public adminOperationsContract;

    /// @dev EIP-712 typehash for `ForwardRequest`
    bytes32 public constant TYPEHASH =
        keccak256(
            "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
        );

    /**
     * @notice Initializes the forwarder with the given `adminOperationsContract`.
     * @param _adminOperationsContract The admin-operations contract address.
     */
    function initialize(address _adminOperationsContract) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        // EIP-712 domain: name = "cNGN", version = "0.0.1"
        __EIP712_init("cNGN", "0.0.1");

        adminOperationsContract = _adminOperationsContract;
    }

    /** ───────────────────────────────────────────────────────────────
     *                              STRUCTS
     *  ───────────────────────────────────────────────────────────────
     */

    struct ForwardRequest {
        address from; // Original signer
        address to; // Target contract
        uint256 value; // msg.value to pass along
        uint256 gas; // Gas limit for the call
        uint256 nonce; // Must equal _nonces[from]
        bytes data; // Calldata (excluding appended “from”)
    }

    /** ───────────────────────────────────────────────────────────────
     *                             MODIFIERS
     *  ───────────────────────────────────────────────────────────────
     */

    /// @dev Reverts if `_msgSender()` is not in `authorizedBridges`.
    modifier onlyAuthorizedBridge() {
        require(
            authorizedBridges[_msgSender()],
            "Forwarder: unauthorized bridge"
        );
        _;
    }

    /** ───────────────────────────────────────────────────────────────
     *                     ADMIN-OPERATIONS UPDATES
     *  ───────────────────────────────────────────────────────────────
     */

    /**
     * @notice Owner can update the admin-operations contract address.
     */
    function updateAdminOperationsAddress(
        address _newAdmin
    ) external onlyOwner returns (bool) {
        require(_newAdmin != address(0), "Forwarder: new admin zero");
        adminOperationsContract = _newAdmin;
        emit AdminOperationsAddressUpdated(_newAdmin);
        return true;
    }

    /**
     * @notice Authorize a bridge so it may call `executeByBridge(...)`.
     */
    function authorizeBridge(address bridgeAddress) external onlyOwner {
        authorizedBridges[bridgeAddress] = true;
        emit BridgeAuthorized(bridgeAddress);
    }

    /**
     * @notice Deauthorize a previously authorized bridge address.
     */
    function deauthorizeBridge(address bridgeAddress) external onlyOwner {
        authorizedBridges[bridgeAddress] = false;
        emit BridgeDeauthorized(bridgeAddress);
    }

    /** ───────────────────────────────────────────────────────────────
     *                        NONCE / REPLAY PROTECTION
     *  ───────────────────────────────────────────────────────────────
     */

    /**
     * @notice Returns the current nonce for `from`.
     */
    function getNonce(address from) external view returns (uint256) {
        return _nonces[from];
    }

    /**
     * @dev Internal: verifies that `req.nonce` exactly equals `_nonces[from]`.
     */
    function _requireValidNonce(ForwardRequest calldata req) internal view {
        require(req.nonce == _nonces[req.from], "Forwarder: nonce mismatch");
    }

    /**
     * @dev Internal: marks a `txHash` as processed.
     */
    function _preventReplay(bytes32 txHash) internal {
        require(!processedTxHashes[txHash], "Forwarder: replay prevented");
        processedTxHashes[txHash] = true;
    }

    /** ───────────────────────────────────────────────────────────────
     *                          SIGNATURE VERIFICATION
     *  ───────────────────────────────────────────────────────────────
     */

    /**
     * @notice Verifies that `signature` matches `req.from` for the typed-data `ForwardRequest`.
     */
    function verify(
        ForwardRequest calldata req,
        bytes calldata signature
    ) public view returns (bool) {
        bytes32 digest = _hashTypedDataV4(
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
        );
        return digest.recover(signature) == req.from;
    }

    /** ───────────────────────────────────────────────────────────────
     *                      INTERNAL EXECUTION LOGIC
     *  ───────────────────────────────────────────────────────────────
     */

    /**
     * @dev Performs all security checks, then `call{value:req.value}` to `req.to` with `req.data`
     *      (appending `req.from` as the last 20 bytes of calldata). Increments nonce and prevents replay.
     */
    function _executeTransaction(
        ForwardRequest calldata req,
        bytes calldata signature
    ) internal returns (bool, bytes memory) {
        // 1) Nonce must match exactly:
        _requireValidNonce(req);

        // 2) Signature must be valid
        require(verify(req, signature), "Forwarder: invalid signature");

        // 3) Check that 'from' is allowed to forward, and neither the relayer nor the actual sender is blacklisted:
        require(
            IAdmin(adminOperationsContract).canForward(req.from),
            "Forwarder: not allowed to forward"
        );
        require(
            !IAdmin(adminOperationsContract).isBlackListed(_msgSender()),
            "Forwarder: relayer blacklisted"
        );
        require(
            !IAdmin(adminOperationsContract).isBlackListed(req.from),
            "Forwarder: from blacklisted"
        );
        // Verify the signer has minting privileges
        require(
            IAdmin(adminOperationsContract).canMint(req.from),
            "Minter not authorized to sign"
        );

        // 4) Prevent replay by hashing the entire request data:
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
        _preventReplay(txHash);

        // 5) Increment the nonce
        _nonces[req.from] = req.nonce + 1;

        // 6) Execute the call, appending `req.from` to the calldata so that
        //    the target contract can extract the original signer.
        (bool success, bytes memory returnData) = req.to.call{value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        emit Executed(success, req.nonce, returnData);
        return (success, returnData);
    }

    /** ───────────────────────────────────────────────────────────────
     *                         PUBLIC EXECUTE METHODS
     *  ───────────────────────────────────────────────────────────────
     */

    /**
     * @notice The contract owner can execute ANY `ForwardRequest`.
     * @param req       The typed request (including `from`, `to`, `value`, `gas`, `nonce`, `data`).
     * @param signature The EIP-712 signature by `req.from`.
     */
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

    /**
     * @notice An authorized bridge (in `authorizedBridges`) can call this to forward a request.
     * @param req       The typed request (including `from`, `to`, `value`, `gas`, `nonce`, `data`).
     * @param signature The EIP-712 signature by `req.from`.
     */
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

    /**
     * @notice Pause all forwarding.  Only owner may call.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause all forwarding.  Only owner may call.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Allow receiving native ETH (for use-cases where `req.value > 0`).
    receive() external payable {}

    uint256[45] private __gap;
}
