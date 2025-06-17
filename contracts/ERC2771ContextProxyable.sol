// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

abstract contract ERC2771ContextProxyable is Initializable, ContextUpgradeable {
    address private _trustedForwarder;

    function __ERC2771ContextProxyable_init(
        address forwarder
    ) internal initializer {
        __Context_init();
        _trustedForwarder = forwarder;
    }

    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == _trustedForwarder;
    }

    function _msgSender()
        internal
        view
        virtual
        override
        returns (address sender)
    {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            // extract last 20 bytes as the real sender
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = super._msgSender();
        }
    }

    function _msgData()
        internal
        view
        virtual
        override
        returns (bytes calldata)
    {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            return msg.data[:msg.data.length - 20];
        } else {
            return super._msgData();
        }
    }
}
