// SPDX-License-Identifier: MIT
// Further information: https://eips.ethereum.org/EIPS/eip-2770
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IOperations.sol";


/**
 * @title Forwarder Smart Contract
 * @dev Simple forwarder for extensible meta-transaction forwarding.
 * This contract has been updated with security improvements.
 */
contract Forwarder is EIP712, Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    event BridgeAuthorized(address indexed bridgeAddress);
    event BridgeDeauthorized(address indexed bridgeAddress);
    event AdminOperationsAddressUpdated(address indexed newAdminAddress);
    event executed(bool indexed success, bytes returnData);
    
    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    address public adminOperationsContract;
    uint256 private immutable _CHAIN_ID;
    bytes32 private immutable _DOMAIN_SEPARATOR;
    bytes32 public constant _TYPEHASH =
        keccak256(
            "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
        );

    mapping(address => bool) public authorizedBridges; // Track authorized bridge contracts
    mapping(bytes32 => bool) public processedTxHashes; // Prevent replay attacks
    mapping(address => uint256) private _nonces;

    modifier onlyAuthorizedBridge() {
        require(authorizedBridges[msg.sender], "Unauthorized bridge");
        _;
    }
    constructor(
        address _adminOperationsContract
    ) EIP712("cNGN", "0.0.1") {
        _CHAIN_ID = block.chainid;
        _DOMAIN_SEPARATOR = _calculateDomainSeparator();
        adminOperationsContract = _adminOperationsContract;
    }

    function _calculateDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("cNGN")),
                keccak256(bytes("0.0.1")),
                block.chainid,
                address(this)
            )
        );
    }

    function getDomainSeparator() public view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function getChainId() public view returns (uint256) {
        return _CHAIN_ID;
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

    function _preventReplay(bytes32 txHash) internal {
        require(!processedTxHashes[txHash], "Replay attack prevented");
        processedTxHashes[txHash] = true;
    }

    function verify(ForwardRequest calldata req, bytes calldata signature)
        public
        view
        returns (bool)
    {
        address signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _TYPEHASH,
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        ).recover(signature);
        return (signer == req.from && req.nonce == _nonces[req.from]);
    }

    function authorizeBridge(address bridgeAddress) external onlyOwner {
        authorizedBridges[bridgeAddress] = true;
        emit BridgeAuthorized(bridgeAddress);  // Emit event
    }

    function deauthorizeBridge(address bridgeAddress) external onlyOwner {
        authorizedBridges[bridgeAddress] = false;
        emit BridgeDeauthorized(bridgeAddress);  // Emit event
    }

     function _executeTransaction(
        ForwardRequest calldata req,
        bytes calldata signature
    ) internal returns (bool, bytes memory) {
        require(
            IAdmin(adminOperationsContract).canForward(req.from),
            "You are not allowed to use this tx route"
        );
        require(
            !IAdmin(adminOperationsContract).isBlackListed(_msgSender()),
            "Relayer is blacklisted"
        );
        require(
            !IAdmin(adminOperationsContract).isBlackListed(req.from),
            "Blacklisted"
        );
        require(
            IAdmin(adminOperationsContract).canMint(req.from),
            "Minter not authorized to sign"
        );
          require(
            verify(req, signature),
            "Forwarder: signature does not match request"
        );

        bytes32 txHash = keccak256(
            abi.encode(req.from, req.to, req.value, req.nonce, req.data)
        );
        _preventReplay(txHash);
        _nonces[req.from] = req.nonce + 1;

        (bool success, bytes memory returndata) = req.to.call{value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        if (success == true) {
            emit executed(success, "execution is a success");
        }
        else {
            emit executed(success, returndata);
        }

        return (success, returndata);
    }

    function execute(
        ForwardRequest calldata req,
        bytes calldata signature
    ) public payable onlyOwner  whenNotPaused nonReentrant  returns (bool, bytes memory) {
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
    receive() external payable {}
}