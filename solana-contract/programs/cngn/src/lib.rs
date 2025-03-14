
// lib.rs
use anchor_lang::prelude::*;

mod state;
mod instructions;

mod errors;
mod events;

use instructions::*;


declare_id!("4yR7dASbCgn1KPLsbJHXdpFMSP1bZUdXMGXdC5P7B4ud");

 #[program]
 pub mod cngn {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, 
                      name: String, 
                      symbol: String, 
                      decimals: u8) -> Result<()> {
        instructions::initialize::initialize_handler(ctx, name, symbol, decimals)
    }
    pub fn initialize_secondary(ctx: Context<InitializeSecondary>) -> Result<()> {
        instructions::initialize::initialize_secondary_handler(ctx)
    }
    

    pub fn initialize_third(ctx: Context<InitializeThird>) -> Result<()> {
        instructions::initialize::initialize_third_handler(ctx)
    }
    pub fn mint(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        instructions::mint::handler(ctx, amount)
    }

    pub fn transfer(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        instructions::transfer::handler(ctx, amount)
    }

    pub fn pause_minting(ctx: Context<PauseMint>, pause_mint: bool) -> Result<()> {
        instructions::pause::pause_mint_handler(ctx, pause_mint)
    }

    pub fn pause_transfers(ctx: Context<PauseTransfer>, pause_transfer: bool) -> Result<()> {
        instructions::pause::pause_transfer_handler(ctx,pause_transfer)
    }

    pub fn burn(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn::handler(ctx, amount)
    }

    pub fn add_can_mint(ctx: Context<AddCanMint>,user: Pubkey) -> Result<()> {
        instructions::admin::add_can_mint_handler(ctx,user)
    }
    
    pub fn remove_can_mint(ctx: Context<RemoveCanMint>,user: Pubkey) -> Result<()> {
        instructions::admin::remove_can_mint_handler(ctx,user)
    }
    
    pub fn update_mint_amount(ctx: Context<UpdateMintAmount>,user: Pubkey, amount: u64) -> Result<()> {
        instructions::admin::update_mint_amount_handler(ctx,user, amount)
    }
    
    pub fn get_mint_amount(ctx: Context<GetMintAmount>,user: Pubkey) -> Result<u64> {
        instructions::admin::get_mint_amount_handler(ctx,user)
    }
    
    pub fn add_trusted_contract(ctx: Context<AddTrustedContract>,contract: Pubkey) -> Result<()> {
        instructions::admin::add_trusted_contract_handler(ctx,contract)
    }
    
    pub fn remove_trusted_contract(ctx: Context<RemoveTrustedContract>,contract: Pubkey) -> Result<()> {
        instructions::admin::remove_trusted_contract_handler(ctx,contract)
    }
    
    pub fn add_blacklist(ctx: Context<AddBlackList>,evil_user: Pubkey) -> Result<()> {
        instructions::admin::add_blacklist_handler(ctx,evil_user)
    }
    
    pub fn remove_blacklist(ctx: Context<RemoveBlackList>,clear_user: Pubkey) -> Result<()> {
        instructions::admin::remove_blacklist_handler(ctx,clear_user)
    }

    pub fn whitelist_internal_user(ctx: Context<WhitelistInternalUser>,user: Pubkey) -> Result<()>{
        instructions::admin::whitelist_internal_user_handler(ctx,user)
    }
    pub fn blacklist_internal_user(ctx: Context<BlacklistInternalUser>,user: Pubkey) -> Result<()>{
        instructions::admin::blacklist_internal_user_handler(ctx,user)
    }

    pub fn whitelist_external_user(ctx: Context<WhitelistExternalUser>,user: Pubkey)->Result<()>{
        instructions::admin::whitelist_external_user_handler(ctx,user)
    }
    pub fn blacklist_external_user(ctx: Context<BlacklistExternalUser>,user: Pubkey)->Result<()>{
        instructions::admin::blacklist_external_user_handler(ctx,user)
    }

    // Add to your program entry point in lib.rs
pub fn add_can_forward(ctx: Context<AddCanForward>, forwarder: Pubkey) -> Result<()> {
    instructions::admin::add_can_forward_handler(ctx, forwarder)
}

pub fn remove_can_forward(ctx: Context<RemoveCanForward>, forwarder: Pubkey) -> Result<()> {
    instructions::admin::remove_can_forward_handler(ctx, forwarder)
}

// pub fn relay_transfer(
//     ctx: Context<RelayTransfer>,
//     signature: Vec<u8>,
//     payload: RelayTransferPayload
// ) -> Result<()> {
//     instructions::relay_transfer_handler(ctx, signature, payload)
// }
}