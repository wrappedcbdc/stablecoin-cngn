// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./IOperations.sol";

contract Cngn2 is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    event DestroyedBlackFunds(address indexed user, uint256 amount);
    event UpdateAdminOperations(
        address indexed oldAddress,
        address indexed newAddress
    );
    event UpdateForwarderContract(
        address indexed oldAddress,
        address indexed newAddress
    );

    modifier onlyDeployerOrForwarder() {
        require(
            msg.sender == owner() || isTrustedForwarder(msg.sender),
            "Caller is not the deployer or the trusted forwarder"
        );
        _;
    }

    modifier onlyAdmin() {
        require(_msgSender() == owner(), "Caller is not admin");
        _;
    }

    modifier onlyTrustedForwarderCaller() {
        require(isTrustedForwarder(msg.sender), "Not trusted forwarder");
        _;
    }

    // constructor() initializer {}

    function initialize(
        address _trustedForwarderContract,
        address _adminOperationsContract
    ) public initializer {
        __ERC20_init("cNGN", "cNGN");
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        trustedForwarderContract = _trustedForwarderContract;
        adminOperationsContract = _adminOperationsContract;
    }

    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == trustedForwarderContract;
    }

    function updateAdminOperationsAddress(
        address _newAdmin
    ) public virtual onlyOwner returns (bool) {
        require(
            _newAdmin != address(0),
            "New admin operations contract address cannot be zero"
        );
        emit UpdateAdminOperations(adminOperationsContract, _newAdmin);
        adminOperationsContract = _newAdmin;
        return true;
    }

    function updateForwarderContract(
        address _newForwarderContract
    ) public virtual onlyOwner returns (bool) {
        require(
            _newForwarderContract != address(0),
            "New forwarder contract address cannot be zero"
        );
        emit UpdateForwarderContract(
            trustedForwarderContract,
            _newForwarderContract
        );
        trustedForwarderContract = _newForwarderContract;
        return true;
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    /**
     * @dev Transfers tokens to a specified address.
     *
     * Special case: If the recipient is an internal whitelisted user and the sender is
     * an external whitelisted sender, the tokens are transferred and then immediately burned.
     * This represents a redemption flow where external users can send tokens to internal users
     * who then redeem them (burn).
     *
     * @param to The address to transfer to
     * @param amount The amount to be transferred
     * @return bool Returns true for a successful transfer
     */
    function transfer(
        address to,
        uint256 amount
    ) public virtual override whenNotPaused nonReentrant returns (bool) {
        address owner = _msgSender();

        // Check for blacklisted addresses
        require(
            !IAdmin(adminOperationsContract).isBlackListed(owner),
            "Sender is blacklisted"
        );
        require(
            !IAdmin(adminOperationsContract).isBlackListed(to),
            "Recipient is blacklisted"
        );

        // Special case: Redemption flow
        if (
            IAdmin(adminOperationsContract).isInternalUserWhitelisted(to) &&
            IAdmin(adminOperationsContract).isExternalSenderWhitelisted(owner)
        ) {
            // Transfer to internal user and then burn (redemption)
            _transfer(owner, to, amount);
            _burn(to, amount);
        } else {
            // Standard transfer
            require(
                !IAdmin(adminOperationsContract).isBlackListed(owner),
                "Sender is blacklisted"
            );
            require(
                !IAdmin(adminOperationsContract).isBlackListed(to),
                "Recipient is blacklisted"
            );
            _transfer(owner, to, amount);
        }

        return true;
    }

    /**
     * @dev Transfers tokens from one address to another using the allowance mechanism.
     *
     * @param from The address to transfer from
     * @param to The address to transfer to
     * @param amount The amount to be transferred
     * @return bool Returns true for a successful transfer
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override whenNotPaused nonReentrant returns (bool) {
        address spender = _msgSender();

        // Check for blacklisted addresses
        require(
            !IAdmin(adminOperationsContract).isBlackListed(spender),
            "Spender is blacklisted"
        );
        require(
            !IAdmin(adminOperationsContract).isBlackListed(from),
            "Sender is blacklisted"
        );
        require(
            !IAdmin(adminOperationsContract).isBlackListed(to),
            "Recipient is blacklisted"
        );
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    /**
     * @dev Mints new tokens to a specified address.
     * The minting process requires authorization and is subject to strict controls:
     * 1. The signer must be authorized to mint
     * 2. The exact amount must match the pre-approved mint amount
     * 3. After minting, the authorization is automatically revoked
     *
     * @param _amount The amount of tokens to mint
     * @param _mintTo The address to mint tokens to
     * @return bool Returns true for a successful mint
     */
    function mint(
        uint256 _amount,
        address _mintTo
    ) public virtual whenNotPaused nonReentrant returns (bool) {
        address sender = _msgSender();
        require(
            !IAdmin(adminOperationsContract).isBlackListed(sender) ||
                !IAdmin(adminOperationsContract).isBlackListed(_mintTo),
            "Signer or receiver is blacklisted"
        );
        require(
            IAdmin(adminOperationsContract).canMint(sender),
            "Minter not authorized to sign"
        );
        require(
            IAdmin(adminOperationsContract).mintAmount(sender) == _amount,
            "Attempting to mint more than allowed"
        );

        _mint(_mintTo, _amount);

        require(
            IAdmin(adminOperationsContract).removeCanMint(sender),
            "Failed to revoke minting authorization"
        );

        return true;
    }

    /**
     * @dev Allows a user to burn their own tokens.
     * This function can only be called by the token owner or the trusted forwarder.
     *
     * @param _amount The amount of tokens to burn
     * @return bool Returns true for a successful burn
     */
    function burnByUser(
        uint256 _amount
    ) public virtual whenNotPaused nonReentrant returns (bool) {
        require(
            !IAdmin(adminOperationsContract).isBlackListed(_msgSender()),
            "User is blacklisted"
        );
        _burn(_msgSender(), _amount);
        return true;
    }

    function pause() public virtual onlyOwner returns (bool) {
        _pause();
        return true;
    }

    function unpause() public virtual onlyOwner returns (bool) {
        _unpause();
        return true;
    }

    function destroyBlackFunds(
        address _blackListedUser
    ) public virtual onlyOwner nonReentrant returns (bool) {
        require(
            IAdmin(adminOperationsContract).isBlackListed(_blackListedUser),
            "Not blacklisted"
        );
        uint256 dirtyFunds = balanceOf(_blackListedUser);
        _burn(_blackListedUser, dirtyFunds);
        emit DestroyedBlackFunds(_blackListedUser, dirtyFunds);
        return true;
    }

    // Meta-tx support: override _msgSender and _msgData
    function _msgSender()
        internal
        view
        virtual
        override
        returns (address sender)
    {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            // Extract sender from calldata
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = msg.sender;
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
            return msg.data;
        }
    }

    //  Preserved variables from V1 — Do NOT remove or reorder
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    address private trustedForwarderContract;
    address private adminOperationsContract;

    uint256[45] private __gap;
}
