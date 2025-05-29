// instructions/initialize.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use crate::events::*;
use crate::errors::ErrorCode;
use crate::state::*;

// Split the accounts into multiple contexts to reduce stack usage
#[derive(Accounts)]
#[instruction(name: String, symbol: String, decimals: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(
        init,
        payer = initializer,
        space = TokenConfig::LEN,
        seeds = [b"token-config", mint.key().as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = initializer,
        space = MintAuthority::LEN,
        seeds = [b"mint-authority", mint.key().as_ref()],
        bump
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    #[account(
        init,
        payer = initializer,
        mint::decimals = decimals,
        mint::authority =initializer, //mint_authority.key(),
        mint::freeze_authority = initializer.key(),
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = initializer,
        space = CanMint::space(100),
        seeds = [b"can-mint", mint.key().as_ref()],
        bump
    )]
    pub can_mint: Account<'info, CanMint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// Secondary accounts context to split the initialization
#[derive(Accounts)]
pub struct InitializeSecondary<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = initializer,
        space = TrustedContracts::space(50),
        seeds = [b"trusted-contracts", mint.key().as_ref()],
        bump
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    #[account(
        init,
        payer = initializer,
        space = BlackList::space(100),
        seeds = [b"blacklist", mint.key().as_ref()],
        bump
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        init,
        payer = initializer,
        space = CanForward::space(100),
        seeds = [b"can-forward", mint.key().as_ref()],
        bump
    )]
    pub can_forward: Account<'info, CanForward>,

    pub system_program: Program<'info, System>,
}

// Third accounts context for the remaining accounts
#[derive(Accounts)]
pub struct InitializeThird<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = initializer,
        space = ExternalWhiteList::space(100),
        seeds = [b"external-whitelist", mint.key().as_ref()],
        bump
    )]
    pub external_whitelist: Account<'info, ExternalWhiteList>,

    #[account(
        init,
        payer = initializer,
        space = InternalWhiteList::space(100),
        seeds = [b"internal-whitelist", mint.key().as_ref()],
        bump
    )]
    pub internal_whitelist: Account<'info, InternalWhiteList>,

    pub system_program: Program<'info, System>,
}

// Primary initialization handler
pub fn initialize_handler(
    ctx: Context<Initialize>,
    name: String,
    symbol: String,
    decimals: u8,
) -> Result<()> {
    let token_config = &mut ctx.accounts.token_config;
    let mint_authority = &mut ctx.accounts.mint_authority;
    let mint = &ctx.accounts.mint;
    let can_mint = &mut ctx.accounts.can_mint;

    if name.len() > TokenConfig::MAX_NAME_LENGTH {
        return Err(ErrorCode::InvalidInstructionFormat.into());
    }

    if symbol.len() > TokenConfig::MAX_SYMBOL_LENGTH {
        return Err(ErrorCode::InvalidInstructionFormat.into());
    }
    // Set token config data
    token_config.name = name.clone();
    token_config.symbol = symbol.clone();
    token_config.decimals = decimals;
    token_config.mint = mint.key();
    token_config.admin = ctx.accounts.initializer.key();
    token_config.mint_paused = false;
    token_config.transfer_paused = false;
    token_config.bump = ctx.bumps.token_config;

    // Set mint authority data
    // In initialize_handler
    mint_authority.mint = mint.key();
    mint_authority.update_authority = ctx.accounts.initializer.key();
    mint_authority.freeze_authority = ctx.accounts.initializer.key();
    mint_authority.bump = ctx.bumps.mint_authority;
    mint_authority.authority =  ctx.accounts.initializer.key();
    
    // Initialize can_mint with a single element to reduce memory usage
    can_mint.mint = mint.key();
    can_mint.authorities = vec![ctx.accounts.initializer.key()];
    can_mint.mint_amounts = vec![0];
    can_mint.bump = ctx.bumps.can_mint;

    // Emit initialize event
    emit!(TokenInitializedEvent {
        mint: mint.key(),
        admin: ctx.accounts.initializer.key(),
        name,
        symbol,
        decimals
    });

    Ok(())
}

// Secondary initialization handler
pub fn initialize_secondary_handler(ctx: Context<InitializeSecondary>) -> Result<()> {
    let blacklist = &mut ctx.accounts.blacklist;
    let can_forward = &mut ctx.accounts.can_forward;
    let trusted_contracts = &mut ctx.accounts.trusted_contracts;

    // Initialize blacklist with pre-allocated capacity but empty content
    blacklist.mint = ctx.accounts.mint.key();
    blacklist.blacklist = Vec::new();
    blacklist.bump = ctx.bumps.blacklist;

    // Initialize can_forward with pre-allocated capacity but empty content
    can_forward.mint = ctx.accounts.mint.key();
    can_forward.forwarders = Vec::new();
    can_forward.bump = ctx.bumps.can_forward;
    can_forward.admin =ctx.accounts.initializer.key();
    can_forward.is_executed = false;

    // Initialize trusted_contracts with pre-allocated capacity but empty content
    trusted_contracts.mint = ctx.accounts.mint.key();
    trusted_contracts.contracts = Vec::new();
    trusted_contracts.bump = ctx.bumps.trusted_contracts;

    // Emit secondary initialization event
    emit!(SecondaryInitializedEvent {
        mint: ctx.accounts.mint.key(),
        initializer: ctx.accounts.initializer.key(),
    });

    Ok(())
}

// Third initialization handler
pub fn initialize_third_handler(ctx: Context<InitializeThird>) -> Result<()> {
    let external_whitelist = &mut ctx.accounts.external_whitelist;
    let internal_whitelist = &mut ctx.accounts.internal_whitelist;

    external_whitelist.mint = ctx.accounts.mint.key();
    external_whitelist.whitelist = Vec::new();
    external_whitelist.bump = ctx.bumps.external_whitelist;

    internal_whitelist.mint = ctx.accounts.mint.key();
    internal_whitelist.whitelist = Vec::new();
    internal_whitelist.bump = ctx.bumps.internal_whitelist;

    // Emit third initialization event
    emit!(ThirdInitializedEvent {
        mint: ctx.accounts.mint.key(),
        initializer: ctx.accounts.initializer.key(),
    });

    Ok(())
}
