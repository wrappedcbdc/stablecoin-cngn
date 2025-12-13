// ========================================================================
// FILE: CngnJetton.tact
// ========================================================================
// Main master contract

import "@stdlib/deploy";
import "@stdlib/stoppable";
import "@stdlib/ownable";
import "./structs";
import "./messages";
import "./trait/MasterState";
import "./trait/MintHandler";
import "./trait/TransferVerificationHandler";
import "./trait/BurnVerificationHandler";
import "./trait/VerificationGuard";
import "./trait/WalletValidator";
contract CngnJetton with 
    Deployable, 
    OwnableTransferable, 
    Resumable,
    MasterState,
    MintHandler,
    TransferVerificationHandler,
    BurnVerificationHandler,
    VerificationGuard,
    WalletValidator
{
    owner: Address;
    stopped: Bool;
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
    content: Cell;
    init(owner: Address, adminOps: Address, forwarder: Address,content: Cell) {
        self.owner = owner;
        self.totalSupply = 0;
        self.mintable = true;
        self.stopped = false;
        self.adminOperationsContract = adminOps;
        self.trustedForwarderContract = forwarder;
        self.nextQueryId = 0;
        self.directMintAllowed = false;
        self.content = content;
        self.master = myAddress(); // For WalletValidator trait
    }

    receive(msg: UpdateAdminOperations) {
        self.requireNotStopped();
        self.requireOwner();
        self.adminOperationsContract = msg.newAdmin;
    }

    receive(msg: UpdateForwarder) {
        self.requireNotStopped();
        self.requireOwner();
        self.trustedForwarderContract = msg.newForwarder;
    }

    // MINT FLOW
    receive(msg: RequestMint) {
        let ctx: Context = context();
        self.requireNotStopped();
        require(msg.receiver != newAddress(0, 0), "Invalid receiver");
        require(msg.amount > 0, "Zero mint");
        
        let queryId: Int = self.generateQueryId();
        self.storePendingMint(queryId, ctx.sender, msg.amount, msg.receiver);
        self.requestMintVerification(queryId, ctx.sender, msg.amount, msg.receiver);
    }

    receive(msg: MintVerificationResponse) {
        let ctx: Context = context();
        self.requireNotStopped();
        require(ctx.sender == self.adminOperationsContract, "Only admin can respond");
        
        let pendingRequest: PendingMintRequest? = self.pendingMints.get(msg.queryId);
        require(pendingRequest != null, "Invalid query ID");
        let request: PendingMintRequest = pendingRequest!!;
        
        require(request.minter == msg.minter, "Minter mismatch");
        require(request.amount == msg.amount, "Amount mismatch");
        require(request.receiver == msg.receiver, "Receiver mismatch");
        
        self.pendingMints.set(msg.queryId, null);
        
        if (msg.approved) {
            self.executeMint(msg.queryId, request);
        }
    }

    // TRANSFER VERIFICATION FLOW
    receive(msg: VerifyWalletTransfer) {
        let ctx: Context = context();
        self.requireNotStopped();
        self.requireValidWallet(msg.sender, ctx.sender);
        
        let masterQueryId: Int = self.generateQueryId();
        
        self.storePendingTransfer(masterQueryId, PendingTransferInfo{
            walletQueryId: msg.queryId,
            walletAddress: ctx.sender,
            sender: msg.sender,
            recipient: msg.recipient,
            amount: msg.amount
        });
        
        self.requestTransferVerification(masterQueryId, msg.sender, msg.recipient, msg.amount);
    }

    receive(msg: TransferVerificationResponse) {
        let ctx: Context = context();
        self.requireNotStopped();
        require(ctx.sender == self.adminOperationsContract, "Only admin can respond");
        
        let pendingTransfer: PendingTransferInfo? = self.pendingTransfers.get(msg.queryId);
        require(pendingTransfer != null, "Invalid query ID");
        let transfer: PendingTransferInfo = pendingTransfer!!;
        
        self.pendingTransfers.set(msg.queryId, null);
        self.sendTransferApproval(transfer, msg.approved, msg.isRedemption);
    }

    // BURN VERIFICATION FLOW
    receive(msg: VerifyWalletBurn) {
        let ctx: Context = context();
        self.requireNotStopped();
        self.requireValidWallet(msg.user, ctx.sender);
        
        let masterQueryId: Int = self.generateQueryId();
        
        self.storePendingBurn(masterQueryId, PendingBurnInfo{
            walletQueryId: msg.queryId,
            walletAddress: ctx.sender,
            user: msg.user,
            amount: msg.amount
        });
        
        self.requestBurnVerification(masterQueryId, msg.user, msg.amount);
    }

    receive(msg: BurnVerificationResponse) {
        let ctx: Context = context();
        self.requireNotStopped();
        require(ctx.sender == self.adminOperationsContract, "Only admin can respond");
        
        let pendingBurn: PendingBurnInfo? = self.pendingBurns.get(msg.queryId);
        require(pendingBurn != null, "Invalid query ID");
        let burn: PendingBurnInfo = pendingBurn!!;
        
        self.pendingBurns.set(msg.queryId, null);
        self.sendBurnApproval(burn, msg.approved);
    }

    // REDEMPTION BURN
    receive(msg: RedemptionBurn) {
        self.requireNotStopped();
        
        let targetWalletInit: StateInit = initOf CngnJettonWallet(msg.user, myAddress());
        send(SendParameters{
            to: contractAddress(targetWalletInit),
            value: NOTIFICATION_GAS,
            mode: SendIgnoreErrors,
            bounce: false,
            body: ForceBurn{query_id: 0, target: msg.user}.toCell()
        });
    }

    // BURN NOTIFICATION
    receive(msg: BurnNotification) {
        self.requireNotStopped();
        self.requireValidWallet(msg.sender, context().sender);
        self.decrementSupply(msg.amount);
    }

    // DIRECT MINT (disabled)
    receive(msg: Mint) {
        throw(001);
    }

    // FORCE BURN BLACKLISTED FUNDS
    receive(msg: DestroyBlacklistedFunds) {
        self.requireNotStopped();
        self.requireOwner();
        
        let initTarget: StateInit = initOf CngnJettonWallet(msg.user, myAddress());
        send(SendParameters{
            to: contractAddress(initTarget),
            value: NOTIFICATION_GAS,
            mode: SendIgnoreErrors,
            bounce: false,
            body: ForceBurn{query_id: 0, target: msg.user}.toCell()
        });
    }

    // GETTERS
    get fun get_jetton_data(): JettonData {
        let walletCode: Cell = initOf CngnJettonWallet(myAddress(), myAddress()).code;
        return JettonData{
            totalSupply: self.totalSupply,
            mintable: self.mintable,
            owner: self.owner,
            content: self.content,
            walletCode: walletCode
        };
    }

    get fun get_wallet_address(owner: Address): Address {
        return self.getWalletAddress(owner);
    }
}