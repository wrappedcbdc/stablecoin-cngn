// ========================================================================
// FILE: master/BurnVerificationHandler.tact
// ========================================================================
// Handles burn verification

import "../structs";
import "../messages";
import "./VerificationGuard";
import "./WalletValidator";
import "./MasterState";
trait BurnVerificationHandler with MasterState, VerificationGuard, WalletValidator {
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
    fun storePendingBurn(masterQueryId: Int, info: PendingBurnInfo) {
        self.pendingBurns.set(masterQueryId, info);
    }
    
    fun requestBurnVerification(queryId: Int, user: Address, amount: Int) {
        send(SendParameters{
            to: self.adminOperationsContract,
            value: MINT_GAS,
            mode: SendIgnoreErrors,
            bounce: true,
            body: VerifyBurnRequest{
                user: user,
                amount: amount,
                queryId: queryId
            }.toCell()
        });
    }
    
    fun sendBurnApproval(burn: PendingBurnInfo, approved: Bool) {
        send(SendParameters{
            to: burn.walletAddress,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: BurnApprovalFromMaster{
                approved: approved,
                queryId: burn.walletQueryId
            }.toCell()
        });
    }
}
