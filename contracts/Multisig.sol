// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MultiSig {
    address[] public owners;         // Array of owners' addresses
    uint256 public required;          // Number of required approvals
    mapping(address => bool) public isOwner; // Mapping to check if an address is an owner
    mapping(uint256 => uint256) public approvals; // Mapping to store approvals for transactions

    event TransactionCreated(address indexed creator, uint256 transactionId);
    event TransactionExecuted(address indexed executor, uint256 transactionId);
    event TransactionApproved(address indexed approver, uint256 transactionId);
    event TransactionRejected(address indexed rejecter, uint256 transactionId);

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
        require(transactions[transactionId].executed == false, "Transaction already executed");
        _;
    }

    struct Transaction {
        address to;                   // Address to call the contract
        uint256 value;                 // ETH value to send (if any)
        bytes data;                    // Calldata for function call
        bool executed;                 // Whether the transaction has been executed
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
            executed: false
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
    function executeTransaction(uint256 transactionId) public onlyOwner transactionExists(transactionId) notExecuted(transactionId) {
        require(approvals[transactionId] >= required, "Not enough approvals");

        Transaction storage txn = transactions[transactionId];
        txn.executed = true;

        // Execute the contract call using the stored calldata
        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        require(success, "Transaction failed");

        emit TransactionExecuted(msg.sender, transactionId);
    }

    // Function to reject a transaction
    function rejectTransaction(uint256 transactionId) public onlyOwner transactionExists(transactionId) {
        require(approvals[transactionId] < required, "Cannot reject executed or approved transactions");
        approvals[transactionId] = 0;
        emit TransactionRejected(msg.sender, transactionId);
    }

    // Function to get the transaction count
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    receive() external payable {}
}


contract TestContract {
  uint256 public value;
  
  function setValue(uint256 _value) public {
    value = _value;
  }
}

// Helper contract for testing failing transactions
contract FailingContract {
  function failingFunction() public pure {
    require(false, "This function always fails");
  }
}