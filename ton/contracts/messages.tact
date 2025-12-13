// ============================================================================
// TEP-74 COMPLIANT JETTON MESSAGES (Standard Opcodes)
// ============================================================================

// Standard Jetton Transfer (TEP-74 Compliant)
// TL-B: transfer#0f8a7ea5 query_id:uint64 amount:(VarUInteger 16) 
//       destination:MsgAddress response_destination:MsgAddress 
//       custom_payload:(Maybe ^Cell) forward_ton_amount:(VarUInteger 16) 
//       forward_payload:(Either Cell ^Cell) = InternalMsgBody
message(0x0f8a7ea5) TokenTransfer {
    query_id: Int as uint64;
    amount: Int as coins;
    destination: Address;
    response_destination: Address;
    custom_payload: Cell;
    forward_ton_amount: Int as coins;
    forward_payload: Cell;
}

// Standard Internal Transfer (TEP-74 Compliant)
// TL-B: internal_transfer#178d4519 query_id:uint64 amount:(VarUInteger 16) 
//       from:MsgAddress response_destination:MsgAddress 
//       forward_ton_amount:(VarUInteger 16) forward_payload:(Either Cell ^Cell) = InternalMsgBody
message(0x178d4519) InternalTransfer {
    query_id: Int as uint64;
    amount: Int as coins;
    from: Address;
    response_destination: Address;
    forward_ton_amount: Int as coins;
    forward_payload: Cell;
}

// Standard Jetton Burn (TEP-74 Compliant)
// TL-B: burn#595f07bc query_id:uint64 amount:(VarUInteger 16) 
//       response_destination:MsgAddress custom_payload:(Maybe ^Cell) = InternalMsgBody
message(0x595f07bc) Burn {
    query_id: Int as uint64;
    amount: Int as coins;
    response_destination: Address;
    custom_payload: Cell;
}

// Standard Burn Notification (TEP-74 Compliant)
// TL-B: burn_notification#7bdd97de query_id:uint64 amount:(VarUInteger 16)
//       sender:MsgAddress response_destination:MsgAddress = InternalMsgBody
message(0x7bdd97de) BurnNotification {
    query_id: Int as uint64;
    amount: Int as coins;
    sender: Address;
    response_destination: Address;
}

// Standard Token Excesses (TEP-74 Compliant)
// TL-B: excesses#d53276db query_id:uint64 = InternalMsgBody
message(0xd53276db) TokenExcesses {
    query_id: Int as uint64;
}

// Standard Transfer Notification (TEP-74 Compliant)
// TL-B: transfer_notification#7362d09c query_id:uint64 amount:(VarUInteger 16) 
//       sender:MsgAddress forward_payload:(Either Cell ^Cell) = InternalMsgBody
message(0x7362d09c) TokenNotification {
    query_id: Int as uint64;
    amount: Int as coins;
    from: Address;
    forward_payload: Slice as remaining;
}

// ============================================================================
// MINTING MESSAGES (Custom - Auto-generated opcodes)
// ============================================================================

message Mint {
    amount: Int as coins;
    receiver: Address;
}

message RequestMint {
    amount: Int as coins;
    receiver: Address;
}

message VerifyMintRequest {
    minter: Address;
    amount: Int as coins;
    receiver: Address;
    queryId: Int as uint64;
}

message MintVerificationResponse {
    approved: Bool;
    minter: Address;
    amount: Int as coins;
    receiver: Address;
    queryId: Int as uint64;
}

message NotifyMintComplete {
    minter: Address;
    receiver: Address;
    amount: Int as coins;
}

// ============================================================================
// ADMIN OPERATIONS MESSAGES (Custom - Auto-generated opcodes)
// ============================================================================

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

message UpdateAdminOperations {
    newAdmin: Address;
}

message UpdateForwarder {
    newForwarder: Address;
}

message ForceBurn {
    query_id: Int as uint64;
    target: Address;
}

message SetJettonMaster {
    jettonMaster: Address;
}

// ============================================================================
// TRANSFER/BURN VERIFICATION MESSAGES (Custom - Auto-generated opcodes)
// ============================================================================

message VerifyWalletTransfer {
    sender: Address;
    recipient: Address;
    amount: Int as coins;
    queryId: Int as uint64;
}

message TransferApprovalFromMaster {
    approved: Bool;
    isRedemption: Bool;
    queryId: Int as uint64;
}

message VerifyTransferRequest {
    sender: Address;
    recipient: Address;
    amount: Int as coins;
    queryId: Int as uint64;
}

message TransferVerificationResponse {
    approved: Bool;
    isRedemption: Bool;
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

message BurnApprovalFromMaster {
    approved: Bool;
    queryId: Int as uint64;
}

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

message RedemptionBurn {
    user: Address;
    amount: Int as coins;
}

// ============================================================================
// FORWARDER MESSAGES (Custom - Auto-generated opcodes)
// ============================================================================

message AuthorizeBridge {
    bridge: Address;
}

message DeauthorizeBridge {
    bridge: Address;
}

message UpdateAdminOps {
    newAdmin: Address;
}

struct ForwardRequest {
    from: Address;
    to: Address;
    value: Int as coins;
    gas: Int as uint64;
    nonce: Int as uint64;
    data: Cell;
}

message ExecuteForward {
    request: ForwardRequest;
    signature: Slice;
}