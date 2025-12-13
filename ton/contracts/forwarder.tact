

// ============================================================================
// FORWARDER CONTRACT
// ============================================================================
import "@stdlib/deploy";
import "@stdlib/ownable";

struct ForwardRequest {
    from: Address;
    to: Address;
    value: Int as coins;
    gas: Int as uint64;
    nonce: Int as uint64;
    data: Cell;
}

message AuthorizeBridge {
    bridge: Address;
}

message DeauthorizeBridge {
    bridge: Address;
}

message ExecuteForward {
    request: ForwardRequest;
    signature: Slice;
}

message UpdateAdminOps {
    newAdmin: Address;
}

contract Forwarder with Deployable, Ownable {
    owner: Address;
    adminOperationsContract: Address;
    chainId: Int as uint256;
    paused: Bool;
    
    authorizedBridges: map<Address, Bool>;
    processedTxHashes: map<Int, Bool>;
    nonces: map<Address, Int>;
    
    init(owner: Address, adminOps: Address) {
        self.owner = owner;
        self.adminOperationsContract = adminOps;
        self.chainId = 0; // TON workchain
        self.paused = false;
    }
    
    receive("pause") {
        self.requireOwner();
        self.paused = true;
    }
    
    receive("unpause") {
        self.requireOwner();
        self.paused = false;
    }
    
    receive(msg: UpdateAdminOps) {
        self.requireOwner();
        self.adminOperationsContract = msg.newAdmin;
    }
    
    receive(msg: AuthorizeBridge) {
        self.requireOwner();
        self.authorizedBridges.set(msg.bridge, true);
    }
    
    receive(msg: DeauthorizeBridge) {
        self.requireOwner();
        self.authorizedBridges.set(msg.bridge, false);
    }
    
    receive(msg: ExecuteForward) {
        require(!self.paused, "Contract is paused");
        let ctx: Context = context();
        
        // Only owner or authorized bridge can execute
        require(
            ctx.sender == self.owner || self.authorizedBridges.get(ctx.sender) == true,
            "Not authorized"
        );
        
        // Verify nonce
        let currentNonce: Int? = self.nonces.get(msg.request.from);
        let expectedNonce: Int = currentNonce != null ? currentNonce!! : 0;
        require(msg.request.nonce == expectedNonce, "Invalid nonce");
        
        // Create tx hash for replay protection
        let txHash: Int = beginCell()
            .storeAddress(msg.request.from)
            .storeAddress(msg.request.to)
            .storeCoins(msg.request.value)
            .storeUint(msg.request.nonce, 64)
            .storeRef(msg.request.data)
            .endCell()
            .hash();
        
        require(self.processedTxHashes.get(txHash) != true, "Replay attack");
        
        // Mark as processed and increment nonce
        self.processedTxHashes.set(txHash, true);
        self.nonces.set(msg.request.from, expectedNonce + 1);
        
        // Forward the message
        send(SendParameters{
            to: msg.request.to,
            value: msg.request.value,
            mode: SendIgnoreErrors,
            bounce: true,
            body: msg.request.data
        });
    }
    
    get fun getNonce(user: Address): Int {
        let nonce: Int? = self.nonces.get(user);
        return nonce != null ? nonce!! : 0;
    }
    
    get fun isBridgeAuthorized(bridge: Address): Bool {
        return self.authorizedBridges.get(bridge) == true;
    }
}
