

struct JettonWalletData {
    balance: Int;
    owner: Address;
    master: Address;
    walletCode: Cell;
}

struct JettonData {
    totalSupply: Int;
    mintable: Bool;
    owner: Address;
    content: Cell;
    walletCode: Cell;
}

struct PendingMintRequest {
    minter: Address;
    amount: Int as coins;
    receiver: Address;
}

struct PendingTransferRequest {
    destination: Address;
    amount: Int as coins;
    responseDestination: Address;
    forwardTonAmount: Int as coins;
    forwardPayload: Cell;
}

struct PendingBurnRequest {
    amount: Int as coins;
    responseDestination: Address;
}


struct PendingTransferInfo {
    walletQueryId: Int as uint64;
    walletAddress: Address;
    sender: Address;
    recipient: Address;
    amount: Int as coins;
}

struct PendingBurnInfo {
    walletQueryId: Int as uint64;
    walletAddress: Address;
    user: Address;
    amount: Int as coins;
}