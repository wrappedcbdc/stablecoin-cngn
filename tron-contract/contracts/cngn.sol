// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;



abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}

abstract contract Pausable is Context {
    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by `account`.
     */
    event Unpaused(address account);

    bool private _paused;

    /**
     * @dev Initializes the contract in unpaused state.
     */
    constructor() {
        _paused = false;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() {
        _requirePaused();
        _;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual returns (bool) {
        return _paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused() internal view virtual {
        require(!paused(), "Pausable: paused");
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused() internal view virtual {
        require(paused(), "Pausable: not paused");
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}

abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be _NOT_ENTERED
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }
}

interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}


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

contract cngn is IERC20, IERC20Metadata, Ownable, Pausable, ReentrancyGuard {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) private isBlackListed;
    mapping(address => bool) private isWhiteListed;
    mapping(address => mapping(address => uint256)) private isMintAllow;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    address trustedForwarderContract;
    address adminOperationsContract;

    event DestroyedBlackFunds(address indexed _blackListedUser, uint256 _balance);
    event AddedBlackList(address indexed _user);
    event RemovedBlackList(address indexed _user);
    event AddedWhiteList(address indexed _user);
    event RemovedWhiteList(address indexed _user);
    event AddedMintAllow(address indexed _user, uint256 _amount);

    modifier onlyDeployerOrForwarder() {
        require(
            msg.sender == owner() || isTrustedForwarder(msg.sender),
            "Caller is not the deployer or the trusted forwarder"
        );
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address _trustedForwarderContract,
        address _adminOperationsContract
    ) {
        _name = name_;
        _symbol = symbol_;
        trustedForwarderContract = _trustedForwarderContract;
        adminOperationsContract = _adminOperationsContract;
    }

    function isTrustedForwarder(address forwarder) public view returns (bool) {
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
    ) public onlyOwner returns (bool) {
        adminOperationsContract = _newAdmin;
        return true;
    }

    function updateForwarderContract(
        address _newForwarderContract
    ) public onlyOwner returns (bool) {
        trustedForwarderContract = _newForwarderContract;
        return true;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
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
            require(!IAdmin(adminOperationsContract).isBlackListed(_msgSender()));
            require(!IAdmin(adminOperationsContract).isBlackListed(to));
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
        _approve(owner, spender, _allowances[owner][spender] + addedValue);
        return true;
    }

    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public virtual returns (bool) {
        address owner = _msgSender();
        uint256 currentAllowance = _allowances[owner][spender];
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
    ) public onlyDeployerOrForwarder nonReentrant returns (bool) {
        address signer = customSender();
        require(
            !IAdmin(adminOperationsContract).isBlackListed(signer),
            "User is blacklisted"
        );
        require(
            !IAdmin(adminOperationsContract).isBlackListed(_mintTo),
            "Receiver is blacklisted"
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

        bool removed = IAdmin(adminOperationsContract).removeCanMint(signer);
        require(removed, "Failed to revoke minting authorization");

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
    ) public virtual onlyDeployerOrForwarder nonReentrant returns (bool) {
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

    function _transfer(address from, address to, uint256 amount) internal {
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
        _balances[_blackListedUser] = 0;
        _totalSupply -= dirtyFunds;
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
