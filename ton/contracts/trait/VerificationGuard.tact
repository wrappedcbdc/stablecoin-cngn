// ========================================================================
// FILE: traits/VerificationGuard.tact
// ========================================================================
// Trait for contracts that need verification logic
trait VerificationGuard {
    nextQueryId: Int as uint64;
    
    fun generateQueryId(): Int {
        let queryId: Int = self.nextQueryId;
        self.nextQueryId = (self.nextQueryId + 1) % 2^64;
        return queryId;
    }
}