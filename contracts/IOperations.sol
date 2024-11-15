// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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

    function AddCanMint(address user) external returns (bool);

    function RemoveCanMint(address user) external returns (bool);

    function AddMintAmount(
        address user,
        uint256 amount
    ) external returns (bool);

    function RemoveMintAmount(address user) external returns (bool);

    function whitelistInternalUser(address user) external returns (bool);

    function blacklistInternalUser(address user) external returns (bool);

    function whitelistExternalSender(address user) external returns (bool);

    function blacklistExternalSender(address user) external returns (bool);

    function AddCanForward(address user) external returns (bool);

    function RemoveCanForward(address user) external returns (bool);

    function AddTrustedContract(
        address contractAddress
    ) external returns (bool);

    function RemoveTrustedContract(
        address contractAddress
    ) external returns (bool);

    function AddBlackList(address evilUser) external returns (bool);

    function RemoveBlackList(address clearedUser) external returns (bool);
