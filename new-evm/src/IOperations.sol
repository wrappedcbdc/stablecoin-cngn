// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IAdmin {
    function canForward(address user) external view returns (bool);

    function canMint(address user) external view returns (bool);

    function mintAmount(address user) external view returns (uint256);

    function isBlackListed(address user) external view returns (bool);

    function trustedContract(
        address contractAddress
    ) external view returns (bool);

    function isExternalSenderWhitelisted(
        address user
    ) external view returns (bool);

    function isInternalUserWhitelisted(
        address user
    ) external view returns (bool);

    function addCanMint(address user) external returns (bool);

    function removeCanMint(address user) external returns (bool);

    function addMintAmount(
        address user,
        uint256 amount
    ) external returns (bool);

    function removeMintAmount(address user) external returns (bool);

    function whitelistInternalUser(address user) external returns (bool);

    function blacklistInternalUser(address user) external returns (bool);

    function whitelistExternalSender(address user) external returns (bool);

    function blacklistExternalSender(address user) external returns (bool);

    function addCanForward(address user) external returns (bool);

    function removeCanForward(address user) external returns (bool);

    function addTrustedContract(
        address contractAddress
    ) external returns (bool);

    function removeTrustedContract(
        address contractAddress
    ) external returns (bool);

    function addBlackList(address evilUser) external returns (bool);

    function removeBlackList(address clearedUser) external returns (bool);
}