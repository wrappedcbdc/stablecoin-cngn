// ========================================================================
// FILE: wallet/WalletState.tact
// ========================================================================
import "../structs";
import "../messages";

trait WalletState {
    balance: Int;
    owner: Address;
    master: Address;
    pendingTransfers: map<Int, PendingTransferRequest>;
    pendingBurns: map<Int, PendingBurnRequest>;
    
    fun validateTransfer(amount: Int, destination: Address) {
        require(destination != newAddress(0, 0), "Invalid destination address");
        require(self.balance >= amount, "Insufficient balance");
        require(amount > 0, "Zero transfer");
    }
    
    fun validateBurn(amount: Int) {
        require(self.balance >= amount, "Insufficient balance");
        require(amount > 0, "Zero burn");
    }
    
    fun deductBalance(amount: Int) {
        self.balance = self.balance - amount;
    }
    
    fun addBalance(amount: Int) {
        self.balance = self.balance + amount;
        require(self.balance >= 0, "Invalid balance");
    }
}