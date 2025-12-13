// ========================================================================
// FILE: trait/TransferVerificationHandler.tact
// ========================================================================
// Handles transfer verification
import "../structs";
import "../messages";
import "./VerificationGuard";
import "./WalletValidator";
import "./MasterState";
trait TransferVerificationHandler with MasterState, VerificationGuard, WalletValidator {
     totalSupply: Int;
    mintable: Bool;
    adminOperationsContract: Address;
    trustedForwarderContract: Address;
    pendingMints: map<Int, PendingMintRequest>;
    pendingTransfers: map<Int, PendingTransferInfo>;
    pendingBurns: map<Int, PendingBurnInfo>;
    directMintAllowed: Bool;
     nextQueryId: Int as uint64;
      master: Address;
    fun storePendingTransfer(masterQueryId: Int, info: PendingTransferInfo) {
        self.pendingTransfers.set(masterQueryId, info);
    }
    
    fun requestTransferVerification(queryId: Int, sender: Address, recipient: Address, amount: Int) {
        send(SendParameters{
            to: self.adminOperationsContract,
            value: MINT_GAS,
            mode: SendIgnoreErrors,
            bounce: true,
            body: VerifyTransferRequest{
                sender: sender,
                recipient: recipient,
                amount: amount,
                queryId: queryId
            }.toCell()
        });
    }
    
    fun sendTransferApproval(transfer: PendingTransferInfo, approved: Bool, isRedemption: Bool) {
        send(SendParameters{
            to: transfer.walletAddress,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: TransferApprovalFromMaster{
                approved: approved,
                isRedemption: isRedemption,
                queryId: transfer.walletQueryId
            }.toCell()
        });
    }
}