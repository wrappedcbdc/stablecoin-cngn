
// events.rs
use anchor_lang::prelude::*;

#[event]
pub struct TokenInitializedEvent {
    pub mint: Pubkey,
    pub admin: Pubkey,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
}

#[event]
pub struct SecondaryInitializedEvent {
    pub mint: Pubkey,
    pub initializer: Pubkey,
}

#[event]
pub struct ThirdInitializedEvent {
    pub mint: Pubkey,
    pub initializer: Pubkey,
}
#[event]
pub struct TokensMintedEvent {
    pub mint: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TokensBurnedEvent {
   pub from: Pubkey,
   pub amount:u64,
   pub owner:Pubkey
}

#[event]
pub struct TokensTransferredEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TokenMintingPauseEvent {
    pub mint: Pubkey,
    pub mint_paused: bool,
}

#[event]
pub struct TokenTransferPauseEvent {
    pub mint: Pubkey,
    pub transfer_paused: bool,
}


#[event]
pub struct WhitelistedMinterEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct BlackListedMinterEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct MintAmountAddedEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MintAmountRemovedEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct WhitelistedContractEvent {
    pub mint: Pubkey,
    pub contract: Pubkey,
}

#[event]
pub struct BlackListedContractEvent {
    pub mint: Pubkey,
    pub contract: Pubkey,
}

#[event]
pub struct AddedBlackListEvent {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct RemovedBlackListEvent {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct WhitelistedInternalUserEvent {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct BlackListedInternalUserEvent {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct WhitelistedExternalSenderEvent {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct BlackListedExternalSenderEvent {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct MintAmountUpdatedEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub amount: u64,
}

// Add to your events.rs file
#[event]
pub struct WhitelistedForwarderEvent {
    pub mint: Pubkey,
    pub forwarder: Pubkey,
}

#[event]
pub struct BlackListedForwarderEvent {
    pub mint: Pubkey,
    pub forwarder: Pubkey,
}

#[event]
pub struct ForwardedEvent {
    pub message: String,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub forwarder: Pubkey
}

// Add this to your events.rs
#[event]
pub struct BridgeBurnEvent {
    pub from_account: Pubkey,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub source_chain: String
}