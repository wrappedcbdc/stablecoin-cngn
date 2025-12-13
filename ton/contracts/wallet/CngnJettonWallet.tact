// ========================================================================
// FILE: wallet/CngnJettonWallet.tact
// ========================================================================
// Main wallet contract 


import "../structs";
import "../messages";
import "./BurnHandler";
import "./TransferHandler";
import "../trait/VerificationGuard";
import "../trait/ReentrancyGuard";
import "./WalletState";
import "../constants";

@interface("org.ton.jetton.wallet")
contract CngnJettonWallet with 
    WalletState, 
    TransferHandler, 
    BurnHandler, 
    ReentrancyGuard, 
    VerificationGuard 
{
    const minTonsForStorage: Int = MIN_TONS_FOR_STORAGE;
    const gasConsumption: Int = GAS_CONSUMPTION;
    balance: Int;
    owner: Address;
    master: Address;
    pendingTransfers: map<Int, PendingTransferRequest>;
    pendingBurns: map<Int, PendingBurnRequest>;
    locked: Bool;
    nextQueryId: Int as uint64;
    init(owner: Address, master: Address) {
        self.balance = 0;
        self.owner = owner;
        self.master = master;
        self.locked = false;
        self.nextQueryId = 0;
    }

    // Transfer request from owner
    receive(msg: TokenTransfer) {
        let ctx: Context = context();
        require(ctx.sender == self.owner, "Not owner");
        self.validateTransfer(msg.amount, msg.destination);
        
        let queryId: Int = self.generateQueryId();
        self.storePendingTransfer(queryId, msg);
        self.sendVerificationRequest(queryId, msg);
    }

    // Approval response from master
    receive(msg: TransferApprovalFromMaster) {
        let ctx: Context = context();
        require(ctx.sender == self.master, "Only master");
        
        let pendingTransfer: PendingTransferRequest? = self.pendingTransfers.get(msg.queryId);
        require(pendingTransfer != null, "Invalid query ID");
        let transfer: PendingTransferRequest = pendingTransfer!!;
        
        self.pendingTransfers.set(msg.queryId, null);
        
        if (msg.approved) {
            self.executeApprovedTransfer(msg.queryId, transfer);
            
            if (msg.isRedemption) {
                send(SendParameters{
                    to: self.master,
                    value: NOTIFICATION_GAS,
                    mode: SendIgnoreErrors,
                    bounce: false,
                    body: RedemptionBurn{
                        user: transfer.destination,
                        amount: transfer.amount
                    }.toCell()
                });
            }
        } else {
            self.sendRejectionNotice();
        }
    }

    // Internal transfer reception
    receive(msg: InternalTransfer) {
        let ctx: Context = context();
        if (ctx.sender != self.master) {
            let sinit: StateInit = initOf CngnJettonWallet(msg.from, self.master);
            require(contractAddress(sinit) == ctx.sender, "Invalid sender!");
        }
        
        self.addBalance(msg.amount);
        
        let msgValue: Int = self.msgValue(ctx.value);
        let fwdFee: Int = ctx.readForwardFee();
        msgValue = (msgValue - msg.forward_ton_amount) - fwdFee;
        
        if (msg.forward_ton_amount > 0) {
            send(SendParameters{
                to: self.owner,
                value: msg.forward_ton_amount,
                mode: SendPayGasSeparately + SendIgnoreErrors,
                bounce: false,
                body: TokenNotification{
                    query_id: msg.query_id,
                    amount: msg.amount,
                    from: msg.from,
                    forward_payload: msg.forward_payload.asSlice()
                }.toCell()
            });
        }
        
        if (msg.response_destination != newAddress(0, 0)) {
            send(SendParameters{
                to: msg.response_destination,
                value: msgValue,
                bounce: false,
                body: TokenExcesses{query_id: msg.query_id}.toCell(),
                mode: SendIgnoreErrors
            });
        }
    }

    // Burn request from owner
    receive(msg: Burn) {
        let ctx: Context = context();
        require(ctx.sender == self.owner, "Not owner");
        self.validateBurn(msg.amount);
        
        let queryId: Int = self.generateQueryId();
        self.storePendingBurn(queryId, msg);
        self.sendBurnVerificationRequest(queryId, msg.amount);
    }

    // Burn approval from master
    receive(msg: BurnApprovalFromMaster) {
        let ctx: Context = context();
        require(ctx.sender == self.master, "Only master");
        
        let pendingBurn: PendingBurnRequest? = self.pendingBurns.get(msg.queryId);
        require(pendingBurn != null, "Invalid query ID");
        let burn: PendingBurnRequest = pendingBurn!!;
        
        self.pendingBurns.set(msg.queryId, null);
        
        if (msg.approved) {
            self.executeApprovedBurn(msg.queryId, burn);
        }
    }

    // Force burn (from master for blacklisted funds)
    receive(msg: ForceBurn) {
        let ctx: Context = context();
        require(ctx.sender == self.master, "Only master can force burn");
        require(self.balance > 0, "Nothing to burn");
        require(msg.target != newAddress(0, 0), "Invalid target");
        
        let toBurn: Int = self.balance;
        self.balance = 0;

        send(SendParameters{
            to: self.master,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: BurnNotification{
                query_id: msg.query_id,
                amount: toBurn,
                sender: self.owner,
                response_destination: self.owner
            }.toCell()
        });
    }

    get fun msgValue(value: Int): Int {
        let msgV: Int = value;
        let tonBalanceBeforeMsg: Int = myBalance() - msgV;
        let storageFee: Int = self.minTonsForStorage - min(tonBalanceBeforeMsg, self.minTonsForStorage);
        msgV = msgV - (storageFee + self.gasConsumption);
        return msgV;
    }

    get fun get_wallet_data(): JettonWalletData {
        return JettonWalletData{
            balance: self.balance,
            owner: self.owner,
            master: self.master,
            walletCode: initOf CngnJettonWallet(self.owner, self.master).code
        };
    }
}