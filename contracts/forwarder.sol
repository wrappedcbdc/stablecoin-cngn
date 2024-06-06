// SPDX-License-Identifier: MIT
// Further information: https://eips.ethereum.org/EIPS/eip-2770
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./IOperations.sol";

/**
 * @title Forwarder Smart Contract
 * @author Pascal Marco Caversaccio, pascal.caversaccio@hotmail.ch
 * @dev Simple forwarder for extensible meta-transaction forwarding.
 */

contract MinimalForwarder is EIP712, Ownable {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    address adminOperationsContract;

    bytes32 public constant _TYPEHASH =
        keccak256(
            "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
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

    function execute(
        ForwardRequest calldata req,
        bytes calldata signature
    ) public payable onlyOwner returns (bool, bytes memory) {
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
        _nonces[req.from] = req.nonce + 1;

        (bool success, bytes memory returndata) = req.to.call{
            gas: req.gas,
            value: req.value
        }(abi.encodePacked(req.data, req.from));

        if (gasleft() <= req.gas / 63) {
            assembly {
                invalid()
            }
        }

        return (success, returndata);
    }

    receive() external payable {}
}
