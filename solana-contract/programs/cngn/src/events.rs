
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
pub struct CanMintAddedEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct CanMintRemovedEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct MintAmountSetEvent {
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
pub struct TrustedContractAddedEvent {
    pub mint: Pubkey,
    pub contract: Pubkey,
}

#[event]
pub struct TrustedContractRemovedEvent {
    pub mint: Pubkey,
    pub contract: Pubkey,
}

#[event]
pub struct BlacklistedEvent {
    pub mint: Pubkey,
    pub evil_user: Pubkey,
}

#[event]
pub struct BlacklistRemovedEvent {
    pub mint: Pubkey,
    pub clear_user: Pubkey,
}

#[event]
pub struct InternalUserWhitelistedEvent {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct InternalUserBlacklistedEvent {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct ExternalUserWhitelistedEvent {
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct ExternalUserBlacklistedEvent {
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
pub struct CanForwardAddedEvent {
    pub mint: Pubkey,
    pub forwarder: Pubkey,
}

#[event]
pub struct CanForwardRemovedEvent {
    pub mint: Pubkey,
    pub forwarder: Pubkey,
}