// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @dev Contract module for user management.
 *
 * This module is used through inheritance. It will make available the contract
 * addresses of users, admin, whitelisting and blacklisting of users.
 */
contract Admin is Initializable, OwnableUpgradeable {
    mapping(address => bool) public canForward;
    mapping(address => bool) public canMint;
    mapping(address => uint256) public mintAmount;
    mapping(address => bool) public trustedContract;
    mapping(address => bool) public isBlackListed;

    event AddedBlackList(address _user);
    event RemovedBlackList(address _user);

    event MintAmountAdded(address _user);
    event MintAmountRemoved(address _user);

    event WhitelistedFowarder(address _user);
    event BlackListedFowarder(address _user);

    event WhitelistedMinter(address _user);
    event BlackListedMinter(address _user);

    event WhitelistedContract(address _user);
    event BlackListedContract(address _user);

    /// add amount check bedore minting

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
        canForward[_msgSender()] = true;
        canMint[_msgSender()] = true;
    }

    modifier onlyOwnerOrTrustedContract() {
        require(
            _msgSender() == owner() || trustedContract[_msgSender()],
            "Not owner or trusted contract"
        );
        _;
    }

    function AddCanMint(
        address _User
    ) public onlyOwnerOrTrustedContract returns (bool) {
        require(!canMint[_User], "User already auhtorized to mint");

        canMint[_User] = true;

        emit WhitelistedMinter(_User);

        return true;
    }

    function RemoveCanMint(
        address _User
    ) public onlyOwnerOrTrustedContract returns (bool) {
        require(canMint[_User], "User not authorized to mint");

        canMint[_User] = false;

        emit BlackListedMinter(_User);

        return true;
    }

    function AddMintAmount(
        address _User, uint256 _Amount
    ) public onlyOwner() returns (bool) {
        require(canMint[_User] == true);
        mintAmount[_User] = _Amount;

        emit MintAmountAdded(_User);

        return true;
    }

    function RemoveMintAmount(
        address _User
    ) public onlyOwner returns (bool) {

        mintAmount[_User] = 0;

        emit MintAmountRemoved(_User);

        return true;
    }

    function AddCanForward(address _User) public onlyOwner returns (bool) {
        require(!canForward[_User], "Forwarder already added");

        canForward[_User] = true;

        emit WhitelistedFowarder(_User);

        return true;
    }

    function RemoveCanForward(address _User) public onlyOwner returns (bool) {
        require(canForward[_User], "User not a forwarder");

        canForward[_User] = false;

        emit BlackListedFowarder(_User);

        return true;
    }

    function AddTrustedContract(
        address _Contract
    ) public onlyOwner returns (bool) {
        require(!trustedContract[_Contract], "Contract already added");

        trustedContract[_Contract] = true;

        emit WhitelistedContract(_Contract);

        return true;
    }

    function RemoveTrustedContract(
        address _Contract
    ) public onlyOwner returns (bool) {
        require(trustedContract[_Contract], "Contract does not exist");

        trustedContract[_Contract] = false;

        emit BlackListedContract(_Contract);

        return true;
    }

    function AddBlackList(address _evilUser) public onlyOwner {
        require(!isBlackListed[_evilUser], "User already BlackListed");

        isBlackListed[_evilUser] = true;

        emit AddedBlackList(_evilUser);
    }

    function RemoveBlackList(
        address _clearedUser
    ) public onlyOwner returns (bool) {
        require(isBlackListed[_clearedUser], "Address not a Listed User");

        isBlackListed[_clearedUser] = false;

        emit RemovedBlackList(_clearedUser);

        return true;
    }

    function _authorizeUpgrade(address newImplementation) internal onlyOwner {}
}
