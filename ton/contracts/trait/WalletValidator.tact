// ========================================================================
// FILE: traits/WalletValidator.tact
// ========================================================================
// Trait for validating wallet addresses
trait WalletValidator {
    master: Address;
    
    fun getWalletAddress(owner: Address): Address {
        let init: StateInit = initOf CngnJettonWallet(owner, self.master);
        return contractAddress(init);
    }
    
    fun requireValidWallet(owner: Address, sender: Address) {
        require(self.getWalletAddress(owner) == sender, "Invalid wallet sender");
    }
}