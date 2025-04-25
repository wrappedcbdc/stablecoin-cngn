
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
pub struct TokenUnpausedEvent {
    pub mint: Pubkey,
    pub mint_paused: bool,
    pub transfer_paused: bool,
}

#[event]
pub struct AdminChangedEvent {
    pub mint: Pubkey,
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
}







#[event]
pub struct WhitelistedMinter {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct BlackListedMinter {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct MintAmountAdded {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MintAmountRemoved {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct WhitelistedContract {
    pub mint: Pubkey,
    pub contract: Pubkey,
}

#[event]
pub struct BlackListedContract {
    pub mint: Pubkey,
    pub contract: Pubkey,
}

#[event]
pub struct AddedBlackList {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct RemovedBlackList {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct WhitelistedInternalUser {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct BlackListedInternalUser {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct WhitelistedExternalSender {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct BlackListedExternalSender {
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
pub struct WhitelistedForwarder {
    pub mint: Pubkey,
    pub forwarder: Pubkey,
}

#[event]
pub struct BlackListedForwarder {
    pub mint: Pubkey,
    pub forwarder: Pubkey,
}

#[event]
pub struct ForwardedEvent {
    pub message: String,
  
}