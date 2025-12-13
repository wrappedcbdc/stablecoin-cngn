// -------------------------------
// Messages / Structs (explicit)
// -------------------------------

message TokenTransfer {
    query_id: Int as uint64;
    amount: Int as coins;
    destination: Address; // owner address of recipient
    response_destination: Address; // optional
    forward_ton_amount: Int as coins;
    forward_payload: Cell;
    custom_payload: Cell;
}
message InternalTransfer {
    query_id: Int as uint64;
    amount: Int as coins;
    from: Address; // sender owner
    response_destination: Address;
    forward_ton_amount: Int as coins;
    forward_payload: Cell;
}
message Burn {
    query_id: Int as uint64;
    amount: Int as coins;
    response_destination: Address;
}
message BurnNotification {
    query_id: Int as uint64;
    amount: Int as coins;
    sender: Address;
    response_destination: Address;
}
// Message for querying excess tokens
message(0xd53276db) TokenExcesses {
    query_id: Int as uint64; // Unique query ID
}
// Notification message for token transfer events
message(0x7362d09c) TokenNotification {
    query_id: Int as uint64; // Unique query ID
    amount: Int as coins; // Amount of tokens transferred
    from: Address; // Sender's address
    forward_payload: Slice as remaining; // Remaining payload for forwarding
    // Comment: Text message when notifying token transfer
}
message Mint {
    amount: Int as coins;
    receiver: Address; // owner address
}
message UpdateAdminOperations {
    newAdmin: Address;
}
message UpdateForwarder {
    newForwarder: Address;
}
message ForceBurn {
    query_id: Int as uint64;
    target: Address; // owner to burn from
}

message AddCanMint {
    user: Address;
}
message RemoveCanMint {
    user: Address;
}
message AddMintAmount {
    user: Address;
    amount: Int as coins;
}
message RemoveMintAmount {
    user: Address;
}
message WhitelistExternalSender {
    user: Address;
}
message BlacklistExternalSender {
    user: Address;
}
message AddCanForward {
    user: Address;
}
message RemoveCanForward {
    user: Address;
}
message AddTrustedContract {
    contractAddr: Address;
}
message RemoveTrustedContract {
    contractAddr: Address;
}
message WhitelistInternalUser {
    user: Address;
}
message BlacklistInternalUser {
    user: Address;
}
message AddBlacklist {
    user: Address;
}
message RemoveBlacklist {
    user: Address;
}
message DestroyBlacklistedFunds {
    user: Address;
}
// Step 1: User requests mint
message RequestMint {
    amount: Int as coins;
     receiver: Address;
}
// Step 2: Jetton asks Admin to verify
message VerifyMintRequest {
    minter: Address;
    amount: Int as coins;
      receiver: Address;
    queryId: Int as uint64;
}
// Step 3: Admin responds with verification result
message(0x12345678) MintVerificationResponse {
    approved: Bool;
    minter: Address;
    amount: Int as coins;
     receiver: Address;
    queryId: Int as uint64;
}
// Step 4: After successful mint, notify Admin to remove mint permission
message NotifyMintComplete {
    minter: Address;
    receiver: Address;
    amount: Int as coins;
}
message SetJettonMaster {
    jettonMaster: Address;
}
// Wallet asks Master to verify
message VerifyWalletTransfer {
    sender: Address;
    recipient: Address;
    amount: Int as coins;
    queryId: Int as uint64;
}
message VerifyWalletBurn {
    user: Address;
    amount: Int as coins;
    queryId: Int as uint64;
}
// Master responds to Wallet
message TransferApprovalFromMaster {
    approved: Bool;
    isRedemption: Bool;
    queryId: Int as uint64;
}
message BurnApprovalFromMaster {
    approved: Bool;
    queryId: Int as uint64;
}
// For redemption flow
message RedemptionBurn {
    user: Address;
    amount: Int as coins;
}
// Transfer verification messages
message VerifyTransferRequest {
    sender: Address;
    recipient: Address;
    amount: Int as coins;
    queryId: Int as uint64;
}
message TransferVerificationResponse {
    approved: Bool;
    isRedemption: Bool; // Special flag for redemption flow
    sender: Address;
    recipient: Address;
    amount: Int as coins;
    queryId: Int as uint64;
}
// Burn verification messages
message VerifyBurnRequest {
    user: Address;
    amount: Int as coins;
    queryId: Int as uint64;
}
message BurnVerificationResponse {
    approved: Bool;
    user: Address;
    amount: Int as coins;
    queryId: Int as uint64;
}