// instructions/initialize.rs
use crate::events::*;
use crate::errors::ErrorCode;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use anchor_spl::token_2022::Token2022;
// Split the accounts into multiple contexts to reduce stack usage
#[derive(Accounts)]
#[instruction(name: String, symbol: String,uri: String, decimals: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(address= crate::ID)]
    pub program: Signer<'info>,

    #[account(
        init,
        payer = initializer,
        space = TokenConfig::LEN,
        seeds = [TOKEN_CONFIG_SEED], // Use TOKEN_CONFIG_SEED as the seed as singleton
        bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = initializer,
        space = MintAuthority::LEN,
        seeds = [MINT_AUTHORITY_SEED, mint.key().as_ref()],
        bump
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = initializer,
        space = CanMint::space(100),
        seeds = [CAN_MINT_SEED, mint.key().as_ref()],
        bump
    )]
    pub can_mint: Account<'info, CanMint>,

    #[account(
        init,
        payer = initializer,
        space = TrustedContracts::space(50),
        seeds = [TRUSTED_CONTRACTS_SEED, mint.key().as_ref()],
        bump
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    #[account(
        init,
        payer = initializer,
        space = CanForward::space(100),
        seeds = [CAN_FORWARD_SEED, mint.key().as_ref()],
        bump
    )]
    pub can_forward: Account<'info, CanForward>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}


// Primary initialization handler
pub fn initialize_handler(
    ctx: Context<Initialize>,
    name: String,
    symbol: String,
    uri: String,
    decimals: u8,
) -> Result<()> {
    let token_config = &mut ctx.accounts.token_config;
    let mint = &ctx.accounts.mint;
    let can_mint = &mut ctx.accounts.can_mint;
    let mint_authority = &mut ctx.accounts.mint_authority;

     // Check if token is already initialized
    require!(
        token_config.admin == Pubkey::default(),
        ErrorCode::TokenAlreadyInitialized
    );
    // Set token config data
    token_config.name = name.clone();
    token_config.symbol = symbol.clone();
    token_config.decimals = decimals;
    token_config.mint = mint.key();
    token_config.mint_paused = false;
    token_config.transfer_paused = false;
    token_config.bump = ctx.bumps.token_config;
    token_config.admin = ctx.accounts.initializer.key();

    // Initialize mint authority data
    mint_authority.mint = mint.key();
    mint_authority.authority = ctx.accounts.initializer.key();
    mint_authority.bump = ctx.bumps.mint_authority;

    // Initialize can_mint with a single element to reduce memory usage
    can_mint.mint = mint.key();
    can_mint.authorities = vec![ctx.accounts.initializer.key()];
    can_mint.mint_amounts = vec![0];
    can_mint.bump = ctx.bumps.can_mint;

    let can_forward = &mut ctx.accounts.can_forward;
    let trusted_contracts = &mut ctx.accounts.trusted_contracts;

    // Initialize can_forward with pre-allocated capacity but empty content
    can_forward.mint = ctx.accounts.mint.key();
    can_forward.forwarders = Vec::new();
    can_forward.bump = ctx.bumps.can_forward;

    // Initialize trusted_contracts with pre-allocated capacity but empty content
    trusted_contracts.mint = ctx.accounts.mint.key();
    trusted_contracts.contracts = Vec::new();
    trusted_contracts.bump = ctx.bumps.trusted_contracts;

    // Emit initialize event
    emit!(TokenInitializedEvent {
        mint: mint.key(),
        admin: ctx.accounts.initializer.key(),
        name: name.clone(),
        symbol: symbol.clone(),
        uri: uri.clone(),
        decimals
    });

    Ok(())
}
