//src/instructions/mint.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};
use crate::state::*;
use crate::events::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"token-config", mint.key().as_ref()],
        bump = token_config.bump,
        constraint = !token_config.mint_paused @ ErrorCode::MintingPaused,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        seeds = [b"mint-authority", mint.key().as_ref()],
        bump = mint_authority.bump,
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = token_account.mint == mint.key() @ ErrorCode::MintMismatch,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"blacklist", mint.key().as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        mut,
        seeds = [b"can-mint", mint.key().as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,
    
    #[account(
        seeds = [b"trusted-contracts", mint.key().as_ref()],
        bump,
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    let signer = ctx.accounts.authority.key();
    let mint_to = ctx.accounts.token_account.owner;

    // Check if signer is blacklisted
    if ctx.accounts.blacklist.is_blacklisted(&signer) {
        return Err(ErrorCode::SignerBlacklisted.into());
    }

    // Check if receiver is blacklisted
    if ctx.accounts.blacklist.is_blacklisted(&mint_to) {
        return Err(ErrorCode::ReceiverBlacklisted.into());
    }

    // Check if signer is authorized to mint
    if !ctx.accounts.can_mint.can_mint(&signer) {
        return Err(ErrorCode::MinterNotAuthorized.into());
    }

    // Check if mint amount matches the allowed amount
    let allowed_amount = ctx.accounts.can_mint.get_mint_amount(&signer)?;
    if amount != allowed_amount {
        return Err(ErrorCode::InvalidMintAmount.into());
    }

    // Prepare for token minting
    let mint = ctx.accounts.mint.to_account_info();
    let token_account = ctx.accounts.token_account.to_account_info();
    let token_program = ctx.accounts.token_program.to_account_info();
    let mint_authority = ctx.accounts.mint_authority.to_account_info();

    // Store the mint key in a variable to extend its lifetime
    let mint_key = ctx.accounts.mint.key();

    // Define the PDA signer seeds
    let seeds = &[
        b"mint-authority",
        mint_key.as_ref(),
        &[ctx.accounts.mint_authority.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Mint tokens
    let cpi_accounts = MintTo {
        mint,
        to: token_account,
        authority: mint_authority,
    };

    let cpi_ctx = CpiContext::new_with_signer(
        token_program,
        cpi_accounts,
        signer_seeds,
    );

    token::mint_to(cpi_ctx, amount)?;

    // Emit minting event
    emit!(TokensMintedEvent {
        mint: ctx.accounts.mint.key(),
        to: ctx.accounts.token_account.key(),
        amount,
    });

     // After successful minting, directly remove the authority:
     if ctx.accounts.can_mint.can_mint(&signer) {
        ctx.accounts.can_mint.remove_authority(&signer)?;
        
        emit!(CanMintRemovedEvent {
            mint: ctx.accounts.token_config.mint,
            authority: signer,
        });
    }
  
    Ok(())
}

