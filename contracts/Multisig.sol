// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

contract MultiSig {
    address[] public owners;         // Array of owners' addresses
    uint256 public required;          // Number of required approvals
    mapping(address => bool) public isOwner; // Mapping to check if an address is an owner
    mapping(uint256 => uint256) public approvals; // Mapping to store approvals for transactions

    event TransactionCreated(address indexed creator, uint256 transactionId);
    event TransactionExecuted(address indexed executor, address indexed destination, uint256 value, bytes data, uint256 transactionId);
    event TransactionApproved(address indexed approver, uint256 transactionId);
    event TransactionRejected(address indexed rejecter, uint256 transactionId);
    event TransactionRemoved(address indexed remover, uint256 transactionId);

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not an owner");
        _;
    }

    modifier transactionExists(uint256 transactionId) {
        require(transactionId < transactions.length, "Transaction does not exist");
        _;
    }

    modifier notApproved(uint256 transactionId) {
        require(approvals[transactionId] < required, "Transaction already has required approvals");
        _;
    }

    modifier notExecuted(uint256 transactionId) {
        require(!transactions[transactionId].executed, "Transaction already executed");
        _;
    }

    struct Transaction {
        address to;                   // Address to call the contract
        uint256 value;                 // ETH value to send (if any)
        bytes data;                    // Calldata for function call
        bool executed;                 // Whether the transaction has been executed
        bool removed;                  // Whether the transaction has been removed
    }

    Transaction[] public transactions; // Array of transactions

    constructor(address[] memory _owners, uint256 _requiredApprovals) {
        require(_owners.length > 1, "At least two owners are required");
        require(_requiredApprovals <= _owners.length, "Invalid required approvals");
        
        for (uint i = 0; i < _owners.length; i++) {
            require(_owners[i] != address(0), "Invalid address");
            require(!isOwner[_owners[i]], "Duplicate owner");
            isOwner[_owners[i]] = true;
        }

        owners = _owners;
        required = _requiredApprovals;
    }

    // Function to create a new transaction
    function submitTransaction(address to, uint256 value, bytes memory data) public onlyOwner {
        uint256 transactionId = transactions.length;
        transactions.push(Transaction({
            to: to,
            value: value,
            data: data,
            executed: false,
            removed: false
        }));

        emit TransactionCreated(msg.sender, transactionId);
    }

    // Function to approve a transaction
    function approveTransaction(uint256 transactionId) public onlyOwner transactionExists(transactionId) notApproved(transactionId) {
        approvals[transactionId]++;

        emit TransactionApproved(msg.sender, transactionId);

        // If we have enough approvals, execute the transaction
        if (approvals[transactionId] >= required) {
            executeTransaction(transactionId);
        }
    }

    // Function to execute a transaction once enough approvals are received
    function executeTransaction(uint256 transactionId) internal onlyOwner transactionExists(transactionId) notExecuted(transactionId) {
        require(approvals[transactionId] >= required, "Not enough approvals");

        Transaction storage txn = transactions[transactionId];
        require(!txn.removed, "Transaction was removed");
        txn.executed = true;

        // Execute the contract call using the stored calldata
        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        require(success, "Transaction failed");
        removeTransaction(transactionId); // Remove the transaction after execution

        emit TransactionExecuted(msg.sender, txn.to, txn.value, txn.data, transactionId);
    }

    // Function to reject a transaction
    function rejectTransaction(uint256 transactionId) public onlyOwner transactionExists(transactionId) {
        require(approvals[transactionId] < required, "Cannot reject executed or approved transactions");
        approvals[transactionId] = 0;
        emit TransactionRejected(msg.sender, transactionId);
    }

    // Function to remove a transaction
    function removeTransaction(uint256 transactionId) public onlyOwner transactionExists(transactionId) {
        Transaction storage txn = transactions[transactionId];
        require(!txn.executed, "Cannot remove executed transactions");
        require(!txn.removed, "Transaction already removed");

        txn.removed = true;
        emit TransactionRemoved(msg.sender, transactionId);
    }

    // Function to get the transaction count
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    receive() external payable {}
}
