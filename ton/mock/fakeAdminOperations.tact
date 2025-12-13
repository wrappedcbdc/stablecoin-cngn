// ============================================================================
// ADMIN OPERATIONS CONTRACT
// ============================================================================
import "@stdlib/deploy";
import "@stdlib/ownable";
import "../contracts/structs";
import "../contracts/messages";

contract FakeAdminOperations with Deployable, Ownable {
    owner: Address;
    canForward: map<Address, Bool>;
    canMint: map<Address, Bool>;
    mintAmount: map<Address, Int>;
    trustedContract: map<Address, Bool>;
    isBlackListed: map<Address, Bool>;
    isExternalSenderWhitelisted: map<Address, Bool>;
    isInternalUserWhitelisted: map<Address, Bool>;
    jettonMasterContract: Address; 
    init(owner: Address){
        self.owner = owner;
        self.canForward.set(owner, true);
        self.canMint.set(owner, true);
        self.jettonMasterContract = newAddress(0, 0);
    }

    // Set the jetton master contract address
    receive(msg: SetJettonMaster){
        self.requireOwner();
        self.jettonMasterContract = msg.jettonMaster;
    }

    // Verify mint request from Jetton contract
    receive(msg: VerifyMintRequest){
        let ctx: Context = context();
        require(ctx.sender == self.jettonMasterContract, "Only jetton master can verify");
        let canMint: Bool = self.canMint.get(msg.user) == true;
        let isBlacklisted: Bool = self.isBlackListed.get(msg.user) == true;
        let allowedAmount: Int? = self.mintAmount.get(msg.user);
        let maxAmount: Int = allowedAmount != null ? allowedAmount!! : 0;
        // Check all conditions
        let approved: Bool = canMint && !isBlacklisted && msg.amount <= maxAmount && msg.amount > 0;
        // Send response back to jetton master
        send(SendParameters{
                to: ctx.sender,
                value: 0,
                mode: SendRemainingValue,
                bounce: true,
                body: MintVerificationResponse{
                    approved: approved,
                    user: msg.user,
                    amount: msg.amount,
                    receiver: msg.receiver,
                    queryId: msg.queryId
                }.toCell()
            }
        );
    }

    // Remove mint permission after successful mint
    receive(msg: NotifyMintComplete){
        let ctx: Context = context();
        require(ctx.sender == self.jettonMasterContract, "Only jetton master can notify");
        // Remove mint permission
        self.canMint.set(msg.user, false);
        // Reset mint amount
        self.mintAmount.set(msg.user, 0);
    }
    // Verify transfer request
    receive(msg: VerifyTransferRequest) {
        let ctx: Context = context();
        require(ctx.sender == self.jettonMasterContract, "Only jetton master can verify");
        
        let senderBlacklisted: Bool = self.isBlackListed.get(msg.sender) == true;
        let recipientBlacklisted: Bool = self.isBlackListed.get(msg.recipient) == true;
        
        // Check if this is a redemption flow
        let isExternalSender: Bool = self.isExternalSenderWhitelisted.get(msg.sender) == true;
        let isInternalRecipient: Bool = self.isInternalUserWhitelisted.get(msg.recipient) == true;
        let isRedemption: Bool = isExternalSender && isInternalRecipient;
        
        // Approve if:
        // 1. Neither party is blacklisted
        // 2. Amount is valid
        let approved: Bool = !senderBlacklisted && 
                            !recipientBlacklisted && 
                            msg.amount > 0;
        
        send(SendParameters{
            to: ctx.sender,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: TransferVerificationResponse{
                approved: approved,
                isRedemption: isRedemption,
                sender: msg.sender,
                recipient: msg.recipient,
                amount: msg.amount,
                queryId: msg.queryId
            }.toCell()
        });
    }
    
    // Verify burn request
    receive(msg: VerifyBurnRequest) {
        let ctx: Context = context();
        require(ctx.sender == self.jettonMasterContract, "Only jetton master can verify");
        
        let userBlacklisted: Bool = self.isBlackListed.get(msg.user) == true;
        
        // Approve if user is not blacklisted and amount is valid
        let approved: Bool = !userBlacklisted && msg.amount > 0;
        
        send(SendParameters{
            to: ctx.sender,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: BurnVerificationResponse{
                approved: approved,
                user: msg.user,
                amount: msg.amount,
                queryId: msg.queryId
            }.toCell()
        });
    }
    receive(msg: AddCanMint){
        self.requireOwnerOrTrustedContract();
        require(self.isBlackListed.get(msg.user) != true, "User is blacklisted");
        require(self.canMint.get(msg.user) != true, "User already added as minter");
        self.canMint.set(msg.user, true);
    }

    receive(msg: RemoveCanMint){
        self.requireOwnerOrTrustedContract();
        require(self.canMint.get(msg.user) == true, "User is not a minter");
        self.canMint.set(msg.user, false);
        self.mintAmount.set(msg.user, 0);
    }

    receive(msg: AddMintAmount){
        self.requireOwner();
        require(self.canMint.get(msg.user) == true, "User must be minter first");
        self.mintAmount.set(msg.user, msg.amount);
    }

    receive(msg: RemoveMintAmount){
        self.requireOwner();
        self.mintAmount.set(msg.user, 0);
    }

    receive(msg: WhitelistExternalSender){
        self.requireOwner();
        require(self.isExternalSenderWhitelisted.get(msg.user) != true, "Already whitelisted");
        self.isExternalSenderWhitelisted.set(msg.user, true);
    }

    receive(msg: BlacklistExternalSender){
        self.requireOwner();
        require(self.isExternalSenderWhitelisted.get(msg.user) == true, "Not whitelisted");
        self.isExternalSenderWhitelisted.set(msg.user, false);
    }

    receive(msg: AddCanForward){
        self.requireOwner();
        require(self.isBlackListed.get(msg.user) != true, "User is blacklisted");
        require(self.canForward.get(msg.user) != true, "Already a forwarder");
        self.canForward.set(msg.user, true);
    }

    receive(msg: RemoveCanForward){
        self.requireOwner();
        require(self.canForward.get(msg.user) == true, "Not a forwarder");
        self.canForward.set(msg.user, false);
    }

    receive(msg: AddTrustedContract){
        self.requireOwner();
        require(self.trustedContract.get(msg.contractAddr) != true, "Already trusted");
        self.trustedContract.set(msg.contractAddr, true);
    }

    receive(msg: RemoveTrustedContract){
        self.requireOwner();
        require(self.trustedContract.get(msg.contractAddr) == true, "Not trusted");
        self.trustedContract.set(msg.contractAddr, false);
    }

    receive(msg: WhitelistInternalUser){
        self.requireOwner();
        require(self.isInternalUserWhitelisted.get(msg.user) != true, "Already whitelisted");
        self.isInternalUserWhitelisted.set(msg.user, true);
    }

    receive(msg: BlacklistInternalUser){
        self.requireOwner();
        require(self.isInternalUserWhitelisted.get(msg.user) == true, "Not whitelisted");
        self.isInternalUserWhitelisted.set(msg.user, false);
    }

    receive(msg: AddBlacklist){
        self.requireOwner();
        require(self.isBlackListed.get(msg.user) != true, "Already blacklisted");
        self.isBlackListed.set(msg.user, true);
    }

    receive(msg: RemoveBlacklist){
        self.requireOwner();
        require(self.isBlackListed.get(msg.user) == true, "Not blacklisted");
        self.isBlackListed.set(msg.user, false);
    }

    fun requireOwnerOrTrustedContract() {
        let ctx: Context = context();
        require(ctx.sender == self.owner || self.trustedContract.get(ctx.sender) == true, "Not authorized");
    }

    get fun getCanForward(user: Address): Bool {
        return self.canForward.get(user) == true;
    }

    get fun getCanMint(user: Address): Bool {
        return self.canMint.get(user) == true;
    }

    get fun getMintAmount(user: Address): Int {
        let amount: Int? = self.mintAmount.get(user);
        return amount != null ? amount!! : 0;
    }

    get fun getIsBlacklisted(user: Address): Bool {
        return self.isBlackListed.get(user) == true;
    }

    get fun getIsExternalWhitelisted(user: Address): Bool {
        return self.isExternalSenderWhitelisted.get(user) == true;
    }

    get fun getIsInternalWhitelisted(user: Address): Bool {
        return self.isInternalUserWhitelisted.get(user) == true;
    }
}