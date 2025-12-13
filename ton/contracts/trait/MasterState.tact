// ========================================================================
// FILE: trait/MasterState.tact
// ========================================================================
// Master contract state management
import "../structs";
trait MasterState {
    totalSupply: Int;
    mintable: Bool;
    adminOperationsContract: Address;
    trustedForwarderContract: Address;
    pendingMints: map<Int, PendingMintRequest>;
    pendingTransfers: map<Int, PendingTransferInfo>;
    pendingBurns: map<Int, PendingBurnInfo>;
    directMintAllowed: Bool;

    fun incrementSupply(amount: Int) {
        require((self.totalSupply + amount) >= self.totalSupply, "Overflow");
        self.totalSupply = self.totalSupply + amount;
    }

    fun decrementSupply(amount: Int) {
        require(self.totalSupply >= amount, "Underflow totalSupply");
        self.totalSupply = self.totalSupply - amount;
    }
}