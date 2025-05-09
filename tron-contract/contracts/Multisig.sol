// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This contract implements a multisignature wallet. It allows multiple owners to
// propose transactions, and then requires a certain number of approvals before
// executing the transaction.

// The contract has the following features:
// - Owners can submit new transactions
// - Owners can approve existing transactions
// - Owners can reject existing transactions
// - The contract executes transactions once enough approvals are received

contract MultiSig {
    // Array of owners' addresses
    address[] public owners;

    // Number of required approvals
    uint256 public required;

    // Mapping to check if an address is an owner
    mapping(address => bool) public isOwner;

    // Mapping to store approvals for transactions
    mapping(uint256 => uint256) public approvals;

    // Event emitted when a transaction is created
    event TransactionCreated(address indexed creator, uint256 transactionId);

    // Event emitted when a transaction is executed
    event TransactionExecuted(address indexed executor, uint256 transactionId);

    // Event emitted when a transaction is approved
    event TransactionApproved(address indexed approver, uint256 transactionId);

    // Event emitted when a transaction is rejected
    event TransactionRejected(address indexed rejecter, uint256 transactionId);

    // Modifier to check if the caller is an owner
    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not an owner");
        _;
    }

    // Modifier to check if a transaction exists
    modifier transactionExists(uint256 transactionId) {
        require(
            transactionId < transactions.length,
            "Transaction does not exist"
        );
        _;
    }

    // Modifier to check if a transaction has not been approved
    modifier notApproved(uint256 transactionId) {
        require(
            approvals[transactionId] < required,
            "Transaction already has required approvals"
        );
        _;
    }

    // Modifier to check if a transaction has not been executed
    modifier notExecuted(uint256 transactionId) {
        require(
            transactions[transactionId].executed == false,
            "Transaction already executed"
        );
        _;
    }

    // Struct to store transactions
    struct Transaction {
        address to; // Address to call the contract
        uint256 value; // ETH value to send (if any)
        bytes data; // Calldata for function call
        bool executed; // Whether the transaction has been executed
    }

    // Array of transactions
    Transaction[] public transactions;

    // Constructor to initialize the contract
    constructor(address[] memory _owners, uint256 _requiredApprovals) {
        // Check that we have at least two owners
        require(_owners.length > 1, "At least two owners are required");

        // Check that the required number of approvals is valid
        require(
            _requiredApprovals <= _owners.length,
            "Invalid required approvals"
        );

        // Initialize the owners array and the isOwner mapping
        for (uint i = 0; i < _owners.length; i++) {
            require(_owners[i] != address(0), "Invalid address");
            require(!isOwner[_owners[i]], "Duplicate owner");
            isOwner[_owners[i]] = true;
        }

        // Set the owners array and the required number of approvals
        owners = _owners;
        required = _requiredApprovals;
    }

    // Function to create a new transaction
    function submitTransaction(
        address to,
        uint256 value,
        bytes memory data
    ) public onlyOwner {
        uint256 transactionId = transactions.length;
        transactions.push(
            Transaction({to: to, value: value, data: data, executed: false})
        );

        // Emit an event to indicate that a transaction has been created
        emit TransactionCreated(msg.sender, transactionId);
    }

    // Function to approve a transaction
    function approveTransaction(
        uint256 transactionId
    )
        public
        onlyOwner
        transactionExists(transactionId)
        notApproved(transactionId)
    {
        // Increment the approval count for the transaction
        approvals[transactionId]++;

        // Emit an event to indicate that a transaction has been approved
        emit TransactionApproved(msg.sender, transactionId);

        // If we have enough approvals, execute the transaction
        if (approvals[transactionId] >= required) {
            executeTransaction(transactionId);
        }
    }

    // Function to execute a transaction once enough approvals are received
    function executeTransaction(
        uint256 transactionId
    )
        public
        onlyOwner
        transactionExists(transactionId)
        notExecuted(transactionId)
    {
        // Check that we have enough approvals
        require(approvals[transactionId] >= required, "Not enough approvals");

        // Mark the transaction as executed
        Transaction storage txn = transactions[transactionId];
        txn.executed = true;

        // Emit an event to indicate that a transaction has been executed
        emit TransactionExecuted(msg.sender, transactionId);

        // Execute the contract call using the stored calldata
        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        require(success, "Transaction failed");
    }

    // Function to reject a transaction
    function rejectTransaction(
        uint256 transactionId
    ) public onlyOwner transactionExists(transactionId) {
        // Check that the transaction has not been executed
        require(
            approvals[transactionId] < required,
            "Cannot reject executed or approved transactions"
        );

        // Reset the approval count for the transaction
        approvals[transactionId] = 0;

        // Emit an event to indicate that a transaction has been rejected
        emit TransactionRejected(msg.sender, transactionId);
    }

    // Function to get the transaction count
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    // Fallback function to receive ETH
    receive() external payable {}
}

// Helper contract for testing failing transactions
contract FailingContract {
    // This function always fails
    function failingFunction() public pure {
        require(false, "This function always fails");
    }
}
