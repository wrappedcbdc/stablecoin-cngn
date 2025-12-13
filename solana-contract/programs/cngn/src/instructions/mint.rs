//src/instructions/mint.rs
use crate::errors::ErrorCode;
use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint = !token_config.mint_paused @ ErrorCode::MintingPaused)]
    pub token_config: Account<'info, TokenConfig>,

    #[account()]
    pub mint_authority: Account<'info, MintAuthority>,

    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = token_account.mint == mint.key() @ ErrorCode::MintMismatch,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub blacklist: Account<'info, BlackList>,

    #[account(mut)]
    pub can_mint: Account<'info, CanMint>,

    #[account(mut)]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    let signer = ctx.accounts.authority.key();
    let mint_to = ctx.accounts.token_account.owner;

    // Check if signer is blacklisted
    require!(
        !ctx.accounts.blacklist.is_blacklisted(&signer),
        ErrorCode::SignerBlacklisted
    );

    // Check if receiver is blacklisted
    require!(
        !ctx.accounts.blacklist.is_blacklisted(&mint_to),
        ErrorCode::ReceiverBlacklisted
    );

    // Check if signer is authorized to mint
    require!(
        ctx.accounts.can_mint.can_mint(&signer),
        ErrorCode::MinterNotAuthorized
    );

    // Check if mint amount matches the allowed amount
    let allowed_amount = ctx.accounts.can_mint.get_mint_amount(&signer)?;
    require!(amount == allowed_amount, ErrorCode::InvalidMintAmount);

    // Store the mint key in a variable to extend its lifetime
    let mint_key = ctx.accounts.mint.key();

    // Define the PDA signer seeds
    let seeds = &[
        MINT_AUTHORITY_SEED,
        mint_key.as_ref(),
        &[ctx.accounts.mint_authority.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Mint tokens
    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.token_account.to_account_info(),
        authority: ctx.accounts.mint_authority.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );

    token_interface::mint_to(cpi_ctx, amount)?;

    // After successful minting, remove the authority
    if ctx.accounts.can_mint.can_mint(&signer) {
        // Remove authority from can_mint (also sets mint amount to 0)
        ctx.accounts.can_mint.remove_authority(&signer)?;

        // Emit can mint removed event
        emit!(BlackListedMinter {
            mint: ctx.accounts.token_config.mint,
            authority: signer,
        });
    }

    // Emit minting event
    emit!(TokensMintedEvent {
        mint: ctx.accounts.mint.key(),
        to: ctx.accounts.token_account.key(),
        amount,
    });

    Ok(())
}
