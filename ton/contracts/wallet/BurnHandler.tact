// ========================================================================
// FILE: wallet/BurnHandler.tact
// ========================================================================
// Handles burn-related logic



import "../structs";
import "../messages";
import "../trait/VerificationGuard";
import "./WalletState";
trait BurnHandler with WalletState, VerificationGuard {
    nextQueryId: Int as uint64;
    balance: Int;
    owner: Address;
    master: Address;
    pendingTransfers: map<Int, PendingTransferRequest>;
    pendingBurns: map<Int, PendingBurnRequest>;
    fun storePendingBurn(queryId: Int, msg: Burn) {
        self.pendingBurns.set(queryId, PendingBurnRequest{
            amount: msg.amount,
            responseDestination: msg.response_destination
        });
    }
    
    fun sendBurnVerificationRequest(queryId: Int, amount: Int) {
        send(SendParameters{
            to: self.master,
            value: VERIFICATION_GAS,
            mode: SendIgnoreErrors,
            bounce: true,
            body: VerifyWalletBurn{
                user: self.owner,
                amount: amount,
                queryId: queryId
            }.toCell()
        });
    }
    
    fun executeApprovedBurn(queryId: Int, burn: PendingBurnRequest) {
        self.deductBalance(burn.amount);
        
        send(SendParameters{
            to: self.master,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: BurnNotification{
                query_id: queryId,
                amount: burn.amount,
                sender: self.owner,
                response_destination: burn.responseDestination
            }.toCell()
        });
    }
}