// ========================================================================
// FILE: trait/MintHandler.tact
// ========================================================================
// Handles minting operations

import "../structs";
import "../messages";
import "./VerificationGuard";
import "./WalletValidator";
import "./MasterState";
import "../wallet/CngnJettonWallet";
trait MintHandler with MasterState, VerificationGuard, WalletValidator {
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

    fun storePendingMint(queryId: Int, minter: Address, amount: Int, receiver: Address) {
        self.pendingMints.set(queryId, PendingMintRequest{minter: minter, amount: amount, receiver: receiver});
    }

    fun requestMintVerification(queryId: Int, minter: Address, amount: Int, receiver: Address) {
        send(SendParameters{
                to: self.adminOperationsContract,
                value: MINT_GAS,
                mode: SendIgnoreErrors,
                bounce: true,
                body: VerifyMintRequest{minter: minter, amount: amount, receiver: receiver, queryId: queryId}.toCell()
            }
        );
    }

    fun executeMint(queryId: Int, request: PendingMintRequest) {
        self.incrementSupply(request.amount);
        let initRecipient: StateInit = initOf CngnJettonWallet(request.receiver, myAddress());
        send(SendParameters{
                to: contractAddress(initRecipient),
                value: NOTIFICATION_GAS,
                mode: SendIgnoreErrors,
                bounce: false,
                body: InternalTransfer{
                    query_id: queryId,
                    amount: request.amount,
                    from: myAddress(),
                    response_destination: request.receiver,
                    forward_ton_amount: 0,
                    forward_payload: emptyCell()
                }.toCell(),
                code: initRecipient.code,
                data: initRecipient.data
            }
        );
        self.notifyMintComplete(request);
    }

    fun notifyMintComplete(request: PendingMintRequest) {
        send(SendParameters{
                to: self.adminOperationsContract,
                value: NOTIFICATION_GAS,
                mode: SendIgnoreErrors,
                bounce: false,
                body: NotifyMintComplete{
                    minter: request.minter,
                    amount: request.amount,
                    receiver: request.receiver
                }.toCell()
            }
        );
    }
}