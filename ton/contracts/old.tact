
// ============================================================================
// JETTON WALLET CONTRACT
// ============================================================================
import "@stdlib/deploy";
import "@stdlib/ownable";
import "./structs";
import "./messages";


contract JettonWallet with Deployable {
    balance: Int as coins;
    owner: Address;
    master: Address;
    
    init(owner: Address, master: Address) {
        self.balance = 0;
        self.owner = owner;
        self.master = master;
    }
    
    receive(msg: JettonTransfer) {
        let ctx: Context = context();
        require(ctx.sender == self.owner, "Not owner");
        require(self.balance >= msg.amount, "Insufficient balance");
        
        self.balance = self.balance - msg.amount;
        
        let init: StateInit = initOf JettonWallet(msg.destination, self.master);
        send(SendParameters{
            to: contractAddress(init),
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: JettonInternalTransfer{
                query_id: msg.query_id,
                amount: msg.amount,
                from: self.owner,
                response_destination: msg.response_destination,
                forward_ton_amount: msg.forward_ton_amount,
                forward_payload: msg.forward_payload
            }.toCell(),
            code: init.code,
            data: init.data
        });
    }
    
    receive(msg: JettonInternalTransfer) {
        let ctx: Context = context();
        let init: StateInit = initOf JettonWallet(msg.from, self.master);
        require(ctx.sender == contractAddress(init), "Invalid sender");
        
        self.balance = self.balance + msg.amount;
        
        if (msg.forward_ton_amount > 0) {
            send(SendParameters{
                to: self.owner,
                value: msg.forward_ton_amount,
                mode: SendPayGasSeparately,
                bounce: false,
                body: msg.forward_payload.asCell()
            });
        }
    }
    
    receive(msg: JettonBurn) {
        let ctx: Context = context();
        require(ctx.sender == self.owner, "Not owner");
        require(self.balance >= msg.amount, "Insufficient balance");
        
        self.balance = self.balance - msg.amount;
        
        send(SendParameters{
            to: self.master,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: JettonBurnNotification{
                query_id: msg.query_id,
                amount: msg.amount,
                sender: self.owner,
                response_destination: msg.response_destination
            }.toCell()
        });
    }
    
    get fun get_wallet_data(): JettonWalletData {
        return
            JettonWalletData{
                balance: self.balance,
                owner: self.owner,
                master: self.master,
                walletCode: initOf JettonWallet(self.master, self.owner).code
            };
    }
}

// ============================================================================
// MAIN JETTON CONTRACT
// ============================================================================

message JettonMint {
    amount: Int as coins;
    receiver: Address;
}

message DestroyBlacklistedFunds {
    user: Address;
}

message UpdateAdminOperations {
    newAdmin: Address;
}

message UpdateForwarder {
    newForwarder: Address;
}

contract CngnJetton2 with Deployable, Ownable {
    owner: Address;
    totalSupply: Int as coins;
    mintable: Bool;
    paused: Bool;
    adminOperationsContract: Address;
    trustedForwarderContract: Address;
    
    init(owner: Address, adminOps: Address, forwarder: Address) {
        self.owner = owner;
        self.totalSupply = 0;
        self.mintable = true;
        self.paused = false;
        self.adminOperationsContract = adminOps;
        self.trustedForwarderContract = forwarder;
    }
    
    receive("pause") {
        self.requireOwner();
        self.paused = true;
    }
    
    receive("unpause") {
        self.requireOwner();
        self.paused = false;
    }
    
    receive(msg: UpdateAdminOperations) {
        self.requireOwner();
        self.adminOperationsContract = msg.newAdmin;
    }
    
    receive(msg: UpdateForwarder) {
        self.requireOwner();
        self.trustedForwarderContract = msg.newForwarder;
    }
    
    receive(msg: JettonMint) {
        require(!self.paused, "Contract paused");
        
        self.totalSupply = self.totalSupply + msg.amount;
        
        let init: StateInit = initOf JettonWallet(msg.receiver, myAddress());
        send(SendParameters{
            to: contractAddress(init),
            value: ton("0.1"),
            mode: SendIgnoreErrors,
            bounce: false,
            body: JettonInternalTransfer{
                query_id: 0,
                amount: msg.amount,
                from: myAddress(),
                response_destination: msg.receiver,
                forward_ton_amount: 0,
                forward_payload: emptySlice()
            }.toCell(),
            code: init.code,
            data: init.data
        });
    }
    
    receive(msg: JettonBurnNotification) {
        let init: StateInit = initOf JettonWallet(msg.sender, myAddress());
        require(context().sender == contractAddress(init), "Invalid wallet");
        
        self.totalSupply = self.totalSupply - msg.amount;
    }
    
    receive(msg: DestroyBlacklistedFunds) {
        self.requireOwner();
        
        let init: StateInit = initOf JettonWallet(msg.user, myAddress());
        send(SendParameters{
            to: contractAddress(init),
            value: ton("0.05"),
            mode: SendIgnoreErrors,
            bounce: false,
            body: JettonBurn{
                query_id: 0,
                amount: pow(10, 9) * 1000000000, // Max amount
                response_destination: myAddress()
            }.toCell()
        });
    }
    
    get fun get_jetton_data(): JettonData {
        let content: Cell = beginCell()
            .storeUint(0, 8)
            .storeSlice("cNGN".asSlice())
            .endCell();
        
        let walletCode: Cell = initOf JettonWallet(myAddress(), myAddress()).code;
        return JettonData{
                totalSupply: self.totalSupply,
                mintable: self.mintable,
                owner: self.owner,
                content: content,
                walletCode: walletCode
            };
        
    }
    
    get fun get_wallet_address(owner: Address): Address {
        let init: StateInit = initOf JettonWallet(owner, myAddress());
        return contractAddress(init);
    }
}

