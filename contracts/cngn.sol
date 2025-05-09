// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./IOperations.sol";

contract Cngn is
    Initializable,
    OwnableUpgradeable,
    ERC20Upgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    event DestroyedBlackFunds(address indexed user, uint256 amount);

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;
    address public trustedForwarderContract;
    address public  adminOperationsContract;


    /**
     * @dev Initializes the contract setting the trusted forwarder and admin operations contracts
     * It's critical to initialize all parent contracts
     */
    function initialize(
        address _trustedForwarderContract,
        address _adminOperationsContract
    ) public initializer {
        // Initialize parent contracts
        __Ownable_init();
        __ERC20_init("cNGN", "cNGN");
        __Pausable_init();
        __ReentrancyGuard_init();
       
        // Set contract-specific state variables
        trustedForwarderContract = _trustedForwarderContract;
        adminOperationsContract = _adminOperationsContract;
    }


    function isTrustedForwarder(
        address forwarder
    ) public view virtual returns (bool) {
        return forwarder == trustedForwarderContract;
    }

    function msgSender() internal view returns (address payable signer) {
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
        adminOperationsContract = _newAdmin;
        return true;
    }

    function updateForwarderContract(
        address _newForwarderContract
    ) public virtual onlyOwner returns (bool) {
        trustedForwarderContract = _newForwarderContract;
        return true;
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

    // Added nonReentrant modifier to prevent reentrancy attacks
    function transfer(
        address to,
        uint256 amount
    ) public virtual override nonReentrant returns (bool) {
        address owner = _msgSender();
        if (
            !IAdmin(adminOperationsContract).isBlackListed(_msgSender()) &&
            !IAdmin(adminOperationsContract).isBlackListed(to) &&
            IAdmin(adminOperationsContract).isInternalUserWhitelisted(to) &&
            IAdmin(adminOperationsContract).isExternalSenderWhitelisted(
                _msgSender()
            )
        ) {
            _transfer(owner, to, amount);
            _burn(to, amount);
            return true;
        } else {
            require(!IAdmin(adminOperationsContract).isBlackListed(_msgSender()));
            require(!IAdmin(adminOperationsContract).isBlackListed(to));
            _transfer(owner, to, amount);
            return true;
        }
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

    // Added nonReentrant modifier to prevent reentrancy attacks
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override whenNotPaused nonReentrant returns (bool) {
        require(!IAdmin(adminOperationsContract).isBlackListed(_msgSender()));
        require(!IAdmin(adminOperationsContract).isBlackListed(from));
        require(!IAdmin(adminOperationsContract).isBlackListed(to));
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function increaseAllowance(
        address spender,
        uint256 addedValue
    ) public virtual override returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, allowance(owner, spender) + addedValue);
        return true;
    }

    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public virtual override returns (bool) {
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

    function mint(
        uint256 _amount,
        address _mintTo
    ) public virtual  nonReentrant returns (bool) {
        // Added nonReentrant modifier for reentrancy protection
        address signer = msgSender();
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

        bool removed = IAdmin(adminOperationsContract).removeCanMint(signer);
        require(removed, "Failed to revoke minting authorization");


        _mint(_mintTo, _amount);



        return true;
    }

    function burnByUser(
        uint256 _amount
    ) public virtual  nonReentrant returns (bool) {
        // Added nonReentrant modifier for reentrancy protection
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
    ) internal virtual override {
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

    function _mint(address account, uint256 amount) internal virtual override {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        unchecked {
            _balances[account] += amount;
        }
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual override {
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
    ) internal virtual override {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual override {
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

    function destroyBlackFunds (address _blackListedUser) 
        public virtual onlyOwner nonReentrant returns (bool) 
        {
        require(IAdmin(adminOperationsContract).isBlackListed(_blackListedUser));
        uint dirtyFunds = balanceOf(_blackListedUser);
        _balances[_blackListedUser] = 0;
        _totalSupply -= dirtyFunds;
        emit DestroyedBlackFunds(_blackListedUser, dirtyFunds);
        return true;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPaused {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {}

    uint256[45] private __gap;
}