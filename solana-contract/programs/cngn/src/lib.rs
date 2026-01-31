// lib.rs
use anchor_lang::prelude::*;

mod errors;
mod events;
mod instructions;
mod state;
use instructions::*;

declare_id!("FQGnUv6gn364e4HjdgzxYnKbEp7FMo8r8CRgmzT1uU65");

#[program]
pub mod cngn {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        name: String,
        symbol: String,
        uri: String,
        decimals: u8,
    ) -> Result<()> {
        instructions::initialize::initialize_handler(ctx, name, symbol, uri, decimals)
    }

    pub fn initialize_multisig(
        ctx: Context<InitializeMultisig>,
        owners: Vec<Pubkey>,
        threshold: u8,
    ) -> Result<()> {
        instructions::multisig::initialize_multisig_handler(ctx, owners, threshold)
    }

    pub fn update_multisig(
        ctx: Context<UpdateMultisig>,
        owners: Vec<Pubkey>,
        threshold: u8,
    ) -> Result<()> {
        instructions::multisig::update_multisig_handler(ctx, owners, threshold)
    }

    pub fn mint(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        instructions::mint::handler(ctx, amount)
    }

    pub fn pause_minting(ctx: Context<PauseMint>, pause_mint: bool) -> Result<()> {
        instructions::pause::pause_mint_handler(ctx, pause_mint)
    }

    pub fn add_can_mint(ctx: Context<AddCanMint>, user: Pubkey) -> Result<()> {
        instructions::admin::add_can_mint_handler(ctx, user)
    }

    pub fn remove_can_mint(ctx: Context<RemoveCanMint>, user: Pubkey) -> Result<()> {
        instructions::admin::remove_can_mint_handler(ctx, user)
    }

    pub fn set_mint_amount(ctx: Context<SetMintAmount>, user: Pubkey, amount: u64) -> Result<()> {
        instructions::admin::set_mint_amount_handler(ctx, user, amount)
    }

    pub fn remove_mint_amount(ctx: Context<RemoveMintAmount>, user: Pubkey) -> Result<()> {
        instructions::admin::remove_mint_amount_handler(ctx, user)
    }

    pub fn get_mint_amount(ctx: Context<GetMintAmount>, user: Pubkey) -> Result<u64> {
        instructions::admin::get_mint_amount_handler(ctx, user)
    }

    pub fn add_trusted_contract(ctx: Context<AddTrustedContract>, contract: Pubkey) -> Result<()> {
        instructions::admin::add_trusted_contract_handler(ctx, contract)
    }

    pub fn remove_trusted_contract(
        ctx: Context<RemoveTrustedContract>,
        contract: Pubkey,
    ) -> Result<()> {
        instructions::admin::remove_trusted_contract_handler(ctx, contract)
    }

    // Add to your program entry point in lib.rs
    pub fn add_can_forward(ctx: Context<AddCanForward>, forwarder: Pubkey) -> Result<()> {
        instructions::admin::add_can_forward_handler(ctx, forwarder)
    }

    pub fn remove_can_forward(ctx: Context<RemoveCanForward>, forwarder: Pubkey) -> Result<()> {
        instructions::admin::remove_can_forward_handler(ctx, forwarder)
    }
}
