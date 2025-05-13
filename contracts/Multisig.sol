// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


/**
 * @title MultiSig
 * @dev This contract implements a multisignature wallet with enhanced security and management features.
 * It allows multiple owners to propose, approve, and execute transactions with built-in governance.
 */
contract MultiSig {
    // Storage for owner addresses
    address[] public owners;

    // Number of required approvals
    uint256 public required;

    // Mapping to check if an address is an owner
    mapping(address => bool) public isOwner;

    // Mapping to track approvals by owner for each transaction
    // transactionId => owner address => approved (true/false)
    mapping(uint256 => mapping(address => bool)) public approvalStatus;

    // Mapping to store approval counts for transactions
    mapping(uint256 => uint256) public approvalCount;

    // Mapping for transactions pendency status
    mapping(uint256 => bool) public isActive;

    // Expiration time for proposals (in seconds)
    uint256 public constant PROPOSAL_EXPIRATION = 30 days;

    // Events
    event OwnerAdded(address indexed newOwner);
    event OwnerRemoved(address indexed removedOwner);
    event RequirementChanged(uint256 required);
    event TransactionCreated(
        address indexed creator,
        uint256 indexed transactionId,
        uint256 expirationTime
    );
    event TransactionExecuted(
        address indexed executor,
        uint256 indexed transactionId
    );
    event TransactionCancelled(
        address indexed canceler,
        uint256 indexed transactionId
    );
    event TransactionExpired(uint256 indexed transactionId);
    event ApprovalReceived(
        address indexed owner,
        uint256 indexed transactionId
    );
    event ApprovalRevoked(address indexed owner, uint256 indexed transactionId);

    // Modifiers

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not an owner");
        _;
    }

    modifier transactionExists(uint256 transactionId) {
        require(
            transactionId < transactions.length,
            "Transaction does not exist"
        );
        _;
    }

    modifier activeTransaction(uint256 transactionId) {
        require(isActive[transactionId], "Transaction is not active");
        _;
    }

    modifier notExecuted(uint256 transactionId) {
        require(
            !transactions[transactionId].executed,
            "Transaction already executed"
        );
        _;
    }

    modifier notExpired(uint256 transactionId) {
        require(
            block.timestamp <= transactions[transactionId].expirationTime,
            "Transaction has expired"
        );
        _;
    }

        /**
     * @dev Modifier that requires function to be called through executeTransaction
     */
    modifier onlyWallet() {
        require(
            msg.sender == address(this),
            "Only callable through wallet execution"
        );
        _;
    }

    // Struct to store transaction details
    struct Transaction {
        address to; // Target address
        uint256 value; // ETH value
        bytes data; // Function call data
        bool executed; // Execution status
        uint256 creationTime; // When the transaction was created
        uint256 expirationTime; // When the transaction expires
        address creator; // Who created the transaction
    }

    // Array of transactions
    Transaction[] public transactions;

    /**
     * @dev Constructor to initialize the contract
     * @param _owners Array of initial owner addresses
     * @param _requiredApprovals Number of required approvals for executing transactions
     */
    constructor(address[] memory _owners, uint256 _requiredApprovals) {
        // Check that we have at least two owners
        require(_owners.length > 1, "At least two owners are required");

        // Check that the required number of approvals is valid
        require(
            _requiredApprovals > 0 && _requiredApprovals <= _owners.length,
            "Invalid required approvals"
        );

        // Initialize the owners array and the isOwner mapping
        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "Invalid owner address");
            require(!isOwner[owner], "Duplicate owner");

            isOwner[owner] = true;
            owners.push(owner);
        }

        required = _requiredApprovals;
    }

    /**
     * @dev Allows an owner to submit a new transaction proposal
     * @param to Target address for the transaction
     * @param value ETH value to send
     * @param data Function call data
     * @return transactionId ID of the created transaction
     */
    function submitTransaction(
        address to,
        uint256 value,
        bytes memory data
    ) public onlyOwner returns (uint256 transactionId) {
        require(to != address(0), "Invalid target address");

        transactionId = transactions.length;

        uint256 expirationTime = block.timestamp + PROPOSAL_EXPIRATION;

        transactions.push(
            Transaction({
                to: to,
                value: value,
                data: data,
                executed: false,
                creationTime: block.timestamp,
                expirationTime: expirationTime,
                creator: msg.sender
            })
        );

        isActive[transactionId] = true;

        // Emit events
        emit TransactionCreated(msg.sender, transactionId, expirationTime);
        emit ApprovalReceived(msg.sender, transactionId);

        // Auto-approve by the submitter
        approvalStatus[transactionId][msg.sender] = true;
        approvalCount[transactionId] = 1;

        // Return the transaction ID
        return transactionId;
    }

    /**
     * @dev Allows an owner to approve a transaction
     * @param transactionId ID of the transaction to approve
     */
    function approveTransaction(
        uint256 transactionId
    )
        public
        onlyOwner
        transactionExists(transactionId)
        activeTransaction(transactionId)
        notExecuted(transactionId)
        notExpired(transactionId)
    {
        // Prevent duplicate approvals
        require(
            !approvalStatus[transactionId][msg.sender],
            "Transaction already approved by this owner"
        );

        // Record the approval
        approvalStatus[transactionId][msg.sender] = true;
        approvalCount[transactionId]++;

        emit ApprovalReceived(msg.sender, transactionId);

        // Execute if we have at least the required number of approvals
        if (approvalCount[transactionId] >= required) {

            executeTransaction(transactionId);
        }
    }

    /**
     * @dev Allows an owner to revoke their approval
     * @param transactionId ID of the transaction
     */
    function revokeApproval(
        uint256 transactionId
    )
        public
        onlyOwner
        transactionExists(transactionId)
        activeTransaction(transactionId)
        notExecuted(transactionId)
        notExpired(transactionId)
    {
        // Check that the owner has approved this transaction
        require(
            approvalStatus[transactionId][msg.sender],
            "Transaction not approved by this owner"
        );

        // Remove the approval
        approvalStatus[transactionId][msg.sender] = false;
        approvalCount[transactionId]--;

        emit ApprovalRevoked(msg.sender, transactionId);
    }

    /**
     * @dev Internal helper to clear approvals from a removed owner
     * @param removedOwner Address of the owner whose approvals should be cleared
     */
    function _clearApprovalsFromOwner(address removedOwner) internal {
        for (uint256 i = 0; i < transactions.length; i++) {
            // Only process active, non-executed, non-expired transactions
            if (isActive[i] && 
                !transactions[i].executed && 
                block.timestamp <= transactions[i].expirationTime) {
                
                // If the removed owner had approved this transaction
                if (approvalStatus[i][removedOwner]) {
                    // Clear the approval
                    approvalStatus[i][removedOwner] = false;
                    // Decrement the approval count
                    approvalCount[i]--;
                }
            }
        }
    }

    /**
     * @dev Executes a transaction if it has enough approvals
     * @param transactionId ID of the transaction to execute
     */
    function executeTransaction(
        uint256 transactionId
    )
        internal
        onlyOwner
    
        transactionExists(transactionId)
        activeTransaction(transactionId)
        notExecuted(transactionId)
        notExpired(transactionId)
    {
        // Check that we have at least the required number of approvals
        require(
            approvalCount[transactionId] >= required,
            "Not enough approvals"
        );

        Transaction storage txn = transactions[transactionId];
        txn.executed = true;

        // Mark transaction as inactive (helps with gas optimization in array cleanup)
        isActive[transactionId] = false;

        // Execute the transaction
        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        require(success, "Transaction execution failed");

         emit TransactionExecuted(msg.sender, transactionId);
    }

    /**
     * @dev Allows transaction creator to cancel a pending transaction
     * @param transactionId ID of the transaction to cancel
     */
    function cancelTransaction(
        uint256 transactionId
    )
        public
        transactionExists(transactionId)
        activeTransaction(transactionId)
        notExecuted(transactionId)
    {
        Transaction storage txn = transactions[transactionId];

        // Only the creator or a consensus of owners can cancel a transaction
        require(
            txn.creator == msg.sender ||
                approvalCount[transactionId] >= required,
            "Only creator or consensus can cancel"
        );

        // Mark as inactive
        isActive[transactionId] = false;

        emit TransactionCancelled(msg.sender, transactionId);
    }

    /**
     * @dev Marks an expired transaction as inactive to free up storage
     * @param transactionId ID of the transaction to mark as expired
     */
    function markExpiredTransaction(
        uint256 transactionId
    )
        public
        transactionExists(transactionId)
        activeTransaction(transactionId)
        notExecuted(transactionId)
    {
        Transaction storage txn = transactions[transactionId];

        require(
            block.timestamp > txn.expirationTime,
            "Transaction has not expired yet"
        );

        // Mark as inactive
        isActive[transactionId] = false;

        emit TransactionExpired(transactionId);
    }

    /**
     * @dev Add a new owner to the multisig (requires multisig consensus)
     * @param newOwner Address of the new owner
     */
    function addOwner(address newOwner) public onlyWallet {
        require(newOwner != address(0), "Invalid owner address");
        require(!isOwner[newOwner], "Address is already an owner");

        isOwner[newOwner] = true;
        owners.push(newOwner);

        emit OwnerAdded(newOwner);
    }

    /**
     * @dev Remove an existing owner (requires multisig consensus)
     * @param ownerToRemove Address of the owner to remove
     */
    function removeOwner(address ownerToRemove) public onlyWallet {
        require(isOwner[ownerToRemove], "Not an owner");
        require(
            owners.length > required,
            "Cannot have fewer owners than required signatures"
        );

        isOwner[ownerToRemove] = false;
        
        // Clear all approvals from the removed owner
        _clearApprovalsFromOwner(ownerToRemove);

        // Remove from owners array
        for (uint i = 0; i < owners.length; i++) {
            if (owners[i] == ownerToRemove) {
                // Move the last element to the position of the removed element
                owners[i] = owners[owners.length - 1];
                // Remove the last element
                owners.pop();
                break;
            }
        }

        // Adjust required confirmations if necessary
        if (required > owners.length) {
            changeRequirement(owners.length);
        }

        emit OwnerRemoved(ownerToRemove);
    }

    /**
     * @dev Replace an existing owner with a new one (requires multisig consensus)
     * @param oldOwner Address of the owner to be replaced
     * @param newOwner Address of the new owner
     */
    function replaceOwner(
        address oldOwner,
        address newOwner
    ) public onlyWallet {
        require(newOwner != address(0), "Invalid owner address");
        require(isOwner[oldOwner], "Not an owner");
        require(!isOwner[newOwner], "Already an owner");

        // Update the owners array
        for (uint i = 0; i < owners.length; i++) {
            if (owners[i] == oldOwner) {
                owners[i] = newOwner;
                break;
            }
        }

        // Update the mapping
        isOwner[oldOwner] = false;
        isOwner[newOwner] = true;
        
        // Clear all approvals from the old owner
        _clearApprovalsFromOwner(oldOwner);

        emit OwnerRemoved(oldOwner);
        emit OwnerAdded(newOwner);
    }

    /**
     * @dev Change the required number of approvals (requires multisig consensus)
     * @param _required New number of required approvals
     */
    function changeRequirement(uint256 _required) public onlyWallet {
        
        require(_required > 0, "Required approvals must be positive");

        require(
            _required <= owners.length,
            "Required approvals cannot exceed owner count"
        );

        required = _required;

        emit RequirementChanged(_required);
    }

    /**
     * @dev Get transaction count, optionally filtered by status
     * @param pending Include pending transactions
     * @param executed Include executed transactions
     * @return count Number of matching transactions
     */
    function getTransactionCount(
        bool pending,
        bool executed
    ) public view returns (uint256 count) {
        for (uint i = 0; i < transactions.length; i++) {
            if (
                (pending && isActive[i] && !transactions[i].executed) ||
                (executed && transactions[i].executed)
            ) {
                count++;
            }
        }
        return count;
    }

    /**
     * @dev Gets list of owners
     * @return Array of owner addresses
     */
    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    /**
     * @dev Gets approval status for a transaction from a specific owner
     * @param transactionId ID of the transaction
     * @param owner Address of the owner
     * @return True if approved by this owner
     */
    function isApprovedBy(
        uint256 transactionId,
        address owner
    ) external view returns (bool) {
        return approvalStatus[transactionId][owner];
    }

    /**
     * @dev Builds the data for an owner management transaction
     * @param method Function selector
     * @param param Parameter for the function call
     * @return Data payload for the transaction
     */
    function buildOwnerTx(
        string memory method,
        address param
    ) external pure returns (bytes memory) {
        if (keccak256(bytes(method)) == keccak256(bytes("addOwner"))) {
            return abi.encodeWithSignature("addOwner(address)", param);
        } else if (
            keccak256(bytes(method)) == keccak256(bytes("removeOwner"))
        ) {
            return abi.encodeWithSignature("removeOwner(address)", param);
        }
        revert("Invalid method");
    }

    /**
     * @dev Builds the data for replacing an owner
     * @param oldOwner Current owner to replace
     * @param newOwner New owner address
     * @return Data payload for the transaction
     */
    function buildReplaceTx(
        address oldOwner,
        address newOwner
    ) external pure returns (bytes memory) {
        return
            abi.encodeWithSignature(
                "replaceOwner(address,address)",
                oldOwner,
                newOwner
            );
    }

    /**
     * @dev Builds the data for changing requirement
     * @param _required New required number of confirmations
     * @return Data payload for the transaction
     */
    function buildRequirementTx(
        uint256 _required
    ) external pure returns (bytes memory) {
        return abi.encodeWithSignature("changeRequirement(uint256)", _required);
    }

    /**
     * @dev Fallback function to receive ETH
     */
    receive() external payable {}
}
