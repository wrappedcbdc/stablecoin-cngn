// lib.rs
use anchor_lang::prelude::*;

mod instructions;
mod state;

mod errors;
mod events;
use crate::errors::ErrorCode;
use instructions::*;

declare_id!("4qgc4qUsecrsXdu1oof3YScMDbH1Ck6NsByLbEARHR4D");

#[program]
pub mod cngn {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        name: String,
        symbol: String,
        decimals: u8,
    ) -> Result<()> {
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
        instructions::transfer::transfer_handler(ctx, amount)
    }

    pub fn pause_minting(ctx: Context<PauseMint>, pause_mint: bool) -> Result<()> {
        instructions::pause::pause_mint_handler(ctx, pause_mint)
    }

    pub fn pause_transfers(ctx: Context<PauseTransfer>, pause_transfer: bool) -> Result<()> {
        instructions::pause::pause_transfer_handler(ctx, pause_transfer)
    }

    pub fn burn(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn::handler(ctx, amount)
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

    pub fn add_blacklist(ctx: Context<AddBlackList>, evil_user: Pubkey) -> Result<()> {
        instructions::admin::add_blacklist_handler(ctx, evil_user)
    }

    pub fn remove_blacklist(ctx: Context<RemoveBlackList>, clear_user: Pubkey) -> Result<()> {
        instructions::admin::remove_blacklist_handler(ctx, clear_user)
    }

    pub fn whitelist_internal_user(
        ctx: Context<WhitelistInternalUser>,
        user: Pubkey,
    ) -> Result<()> {
        instructions::admin::whitelist_internal_user_handler(ctx, user)
    }
    pub fn blacklist_internal_user(
        ctx: Context<BlacklistInternalUser>,
        user: Pubkey,
    ) -> Result<()> {
        instructions::admin::blacklist_internal_user_handler(ctx, user)
    }

    pub fn whitelist_external_user(
        ctx: Context<WhitelistExternalUser>,
        user: Pubkey,
    ) -> Result<()> {
        instructions::admin::whitelist_external_user_handler(ctx, user)
    }
    pub fn blacklist_external_user(
        ctx: Context<BlacklistExternalUser>,
        user: Pubkey,
    ) -> Result<()> {
        instructions::admin::blacklist_external_user_handler(ctx, user)
    }

    // Add to your program entry point in lib.rs
    pub fn add_can_forward(ctx: Context<AddCanForward>, forwarder: Pubkey) -> Result<()> {
        instructions::admin::add_can_forward_handler(ctx, forwarder)
    }

    pub fn remove_can_forward(ctx: Context<RemoveCanForward>, forwarder: Pubkey) -> Result<()> {
        instructions::admin::remove_can_forward_handler(ctx, forwarder)
    }

    pub fn initialize_user_nonce(ctx: Context<InitializeUserNonce>) -> Result<()> {
        instructions::forwarder::initialize_user_nonce_handler(ctx)
    }

    pub fn execute(
        ctx: Context<Execute>,
        message_string: String,
        signature_string: String,
        amount: u64,
    ) -> Result<String> {
        // Convert hex strings to bytes
        let sender_public_key =
            hex::decode(bytes_to_hex_string(&ctx.accounts.sender.key.to_bytes()))
                .map_err(|_| ErrorCode::InvalidPublicKey)?;

        let message = hex::decode(&message_string).map_err(|_| ErrorCode::InvalidMessage)?;

        let signature = hex::decode(&signature_string).map_err(|_| ErrorCode::InvalidSignature)?;

        instructions::forwarder::verify_ed25519_instruction(
            ctx,
            &sender_public_key,
            &message,
            &signature,
            amount,
        )
    }
}

fn bytes_to_hex_string(bytes: &[u8]) -> String {
    hex::encode(bytes)
}
