// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.11;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol"; // Added for reentrancy protection
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "./IOperations.sol";

contract Cngn2 is
    Initializable,
    OwnableUpgradeable,
    IERC20MetadataUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable // Added for reentrancy protection
{
    event DestroyedBlackFunds(
        address indexed user, 
        uint256 amount
    );
    event UpdateAdminOperations(
        address indexed oldAddress,
        address indexed newAddress
    );
    event UpdateForwarderContract(
        address indexed oldAddress,
        address indexed newAddress
    );

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    address public trustedForwarderContract;
    address public adminOperationsContract;

    // /// @custom:oz-upgrades-unsafe-allow constructor state-variable-immutable
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    modifier onlyDeployerOrForwarder() {
        require(
            msg.sender == owner() || isTrustedForwarder(msg.sender),
            "Caller is not the deployer or the trusted forwarder"
        );
        _;
    }

    function __ERC20_init(
        string memory name_,
        string memory symbol_
    ) internal onlyInitializing {
        __ERC20_init_unchained(name_, symbol_);
    }

    function __ERC20_init_unchained(
        string memory name_,
        string memory symbol_
    ) internal onlyInitializing {
        _name = name_;
        _symbol = symbol_;
    }

    function initialize(
        address _trustedForwarderContract,
        address _adminOperationsContract
    ) public initializer {
        __ERC20_init("cNGN", "cNGN");
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init(); // Initialize ReentrancyGuardUpgradeable
        trustedForwarderContract = _trustedForwarderContract;
        adminOperationsContract = _adminOperationsContract;
    }

    function isTrustedForwarder(
        address forwarder
    ) public view virtual returns (bool) {
        return forwarder == trustedForwarderContract;
    }

    /**
     * @dev Returns the sender of the transaction. If the transaction is sent through
     * a trusted forwarder, returns the original sender from the calldata.
     * @return signer The address of the transaction sender
     */
    function customSender() internal view returns (address payable signer) {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            assembly {
                signer := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            signer = payable(msg.sender);
        }
        return signer;
    }

    function updateAdminOperationsAddress(
        address _newAdmin
    ) public virtual onlyOwner returns (bool) {
        require(
            _newAdmin != address(0),
            "New admin operations contract address cannot be zero"
        );
        emit UpdateAdminOperations(
            adminOperationsContract,
            _newAdmin
        );
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

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(
        address account
    ) public view virtual override returns (uint256) {
        return _balances[account];
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
    ) public virtual override nonReentrant returns (bool) {
        address owner = _msgSender();
        
        // Check for blacklisted addresses
        require(!IAdmin(adminOperationsContract).isBlackListed(owner), "Sender is blacklisted");
        require(!IAdmin(adminOperationsContract).isBlackListed(to), "Recipient is blacklisted");
        
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
            require(!IAdmin(adminOperationsContract).isBlackListed(owner), "Sender is blacklisted");
            require(!IAdmin(adminOperationsContract).isBlackListed(to), "Recipient is blacklisted");
            _transfer(owner, to, amount);
        }
        
        return true;
    }

    function allowance(
        address owner,
        address spender
    ) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(
        address spender,
        uint256 amount
    ) public virtual override returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, amount);
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
        require(!IAdmin(adminOperationsContract).isBlackListed(spender), "Spender is blacklisted");
        require(!IAdmin(adminOperationsContract).isBlackListed(from), "Sender is blacklisted");
        require(!IAdmin(adminOperationsContract).isBlackListed(to), "Recipient is blacklisted");
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function increaseAllowance(
        address spender,
        uint256 addedValue
    ) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, allowance(owner, spender) + addedValue);
        return true;
    }

    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public virtual returns (bool) {
        address owner = _msgSender();
        uint256 currentAllowance = allowance(owner, spender);

        require(
            currentAllowance >= subtractedValue,
            "ERC20: decreased allowance below zero"
        );
        unchecked {
            _approve(owner, spender, currentAllowance - subtractedValue);
        }

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
    ) public virtual nonReentrant returns (bool) {
        address signer = customSender();
        require(
            !IAdmin(adminOperationsContract).isBlackListed(signer) ||
            !IAdmin(adminOperationsContract).isBlackListed(_mintTo),
            "Signer or receiver is blacklisted"
        );
        require(
            IAdmin(adminOperationsContract).canMint(signer),
            "Minter not authorized to sign"
        );
        require(
            IAdmin(adminOperationsContract).mintAmount(signer) == _amount,
            "Attempting to mint more than allowed"
        );

        _mint(_mintTo, _amount);

        require(
            IAdmin(adminOperationsContract).removeCanMint(signer), 
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
    ) public virtual nonReentrant returns (bool) {
        require(!IAdmin(adminOperationsContract).isBlackListed(_msgSender()), "User is blacklisted");
        _burn(_msgSender(), _amount);
        return true;
    }

    function pause() public virtual onlyOwner returns (bool) {
        _pause();
        return true;
    }

    function unPause() public virtual onlyOwner returns (bool) {
        _unpause();
        return true;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(from, to, amount);

        uint256 fromBalance = _balances[from];
        require(
            fromBalance >= amount,
            "ERC20: transfer amount exceeds balance"
        );
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }

        emit Transfer(from, to, amount);

        _afterTokenTransfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        unchecked {
            _balances[account] += amount;
        }
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - amount;
            _totalSupply -= amount;
        }

        emit Transfer(account, address(0), amount);

        _afterTokenTransfer(account, address(0), amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(
                currentAllowance >= amount,
                "ERC20: insufficient allowance"
            );
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

    /**
     * @dev Destroys all tokens from a blacklisted address.
     * This function can only be called by the contract owner.
     * The tokens are removed from circulation (total supply is reduced).
     * 
     * @param _blackListedUser The blacklisted address whose funds will be destroyed
     * @return bool Returns true for a successful operation
     */
    function destroyBlackFunds(address _blackListedUser) 
        public virtual onlyOwner nonReentrant returns (bool) 
    {
        require(
            IAdmin(adminOperationsContract).isBlackListed(_blackListedUser),
            "Address is not blacklisted"
        );
        uint dirtyFunds = balanceOf(_blackListedUser);
        _burn(_blackListedUser, dirtyFunds);
        emit DestroyedBlackFunds(_blackListedUser, dirtyFunds);
        return true;
    }

    /**
     * @dev Hook that is called before any token transfer.
     * The contract must not be paused.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual whenNotPaused {}

    /**
     * @dev Hook that is called after any token transfer.
     * Can be used to implement additional logic after transfers.
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    uint256[45] private __gap;
}
