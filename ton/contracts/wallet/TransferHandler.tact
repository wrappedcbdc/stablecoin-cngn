// ========================================================================
// FILE: wallet/TransferHandler.tact
// ========================================================================
// Handles transfer-related logic


import "@stdlib/deploy";
import "@stdlib/stoppable";
import "@stdlib/ownable";
import "../structs";
import "../messages";
import "../trait/VerificationGuard";
import "../trait/ReentrancyGuard";
import "./WalletState";

trait TransferHandler with WalletState, VerificationGuard, ReentrancyGuard {
locked: Bool;
    nextQueryId: Int as uint64;
    balance: Int;
    owner: Address;
    master: Address;
    pendingTransfers: map<Int, PendingTransferRequest>;
    pendingBurns: map<Int, PendingBurnRequest>;
    
    fun storePendingTransfer(queryId: Int, msg: TokenTransfer) {
        self.pendingTransfers.set(queryId, PendingTransferRequest{
            amount: msg.amount,
            destination: msg.destination,
            responseDestination: msg.response_destination,
            forwardTonAmount: msg.forward_ton_amount,
            forwardPayload: msg.forward_payload
        });
    }
    
    fun sendVerificationRequest(queryId: Int, msg: TokenTransfer) {
        send(SendParameters{
            to: self.master,
            value: VERIFICATION_GAS,
            mode: SendIgnoreErrors,
            bounce: true,
            body: VerifyWalletTransfer{
                sender: self.owner,
                recipient: msg.destination,
                amount: msg.amount,
                queryId: queryId
            }.toCell()
        });
    }
    
    fun executeApprovedTransfer(queryId: Int, transfer: PendingTransferRequest) {
        self.requireNotLocked();
        self.lock();
        
        self.deductBalance(transfer.amount);
        
        let initDest: StateInit = initOf CngnJettonWallet(transfer.destination, self.master);
        
        send(SendParameters{
            to: contractAddress(initDest),
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: InternalTransfer{
                query_id: queryId,
                amount: transfer.amount,
                from: self.owner,
                response_destination: transfer.responseDestination,
                forward_ton_amount: transfer.forwardTonAmount,
                forward_payload: transfer.forwardPayload
            }.toCell(),
            code: initDest.code,
            data: initDest.data
        });
        
        self.unlock();
    }
    
    fun sendRejectionNotice() {
        send(SendParameters{
            to: self.owner,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: "Transfer rejected by admin".asComment()
        });
    }
}