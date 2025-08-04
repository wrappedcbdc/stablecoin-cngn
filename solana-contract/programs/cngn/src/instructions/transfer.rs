// src/instructions/transfer.rs
use crate::errors::ErrorCode;
use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"token-config", from.mint.as_ref()],
        bump = token_config.bump,
        constraint = !token_config.transfer_paused @ ErrorCode::TransfersPaused,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        constraint = from.owner == owner.key() @ ErrorCode::InvalidOwner,
    )]
    pub from: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = to.mint == from.mint @ ErrorCode::MintMismatch,
    )]
    pub to: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = from.mint
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"blacklist", from.mint.as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        seeds = [b"internal-whitelist", from.mint.as_ref()],
        bump,
    )]
    pub internal_whitelist: Account<'info, InternalWhiteList>,

    #[account(
        seeds = [b"external-whitelist", from.mint.as_ref()],
        bump,
    )]
    pub external_whitelist: Account<'info, ExternalWhiteList>,

    pub token_program: Program<'info, Token>,
}

pub fn transfer_handler(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
    let sender = ctx.accounts.owner.key();
    let recipient = ctx.accounts.to.owner;

    // Explicit balance check
    if ctx.accounts.from.amount < amount {
        return Err(ErrorCode::InsufficientFunds.into());
    }
    // Check if either sender or recipient is blacklisted
    if ctx.accounts.blacklist.is_blacklisted(&sender)
        || ctx.accounts.blacklist.is_blacklisted(&recipient)
    {
        return Err(ErrorCode::UserBlacklisted.into());
    }

    // Special case: If sender is external whitelisted AND recipient is internal whitelisted
    // We burn the tokens from the sender's account before transferring
    if ctx.accounts.external_whitelist.is_whitelisted(&sender)
        && ctx.accounts.internal_whitelist.is_whitelisted(&recipient)
    {
        // 1. Burn the tokens from the sender's account (where we have authority)
        let burn_cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.from.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(), // Owner has authority over their account
        };

        let burn_cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            burn_cpi_accounts,
        );

        // Burn the tokens
        token::burn(burn_cpi_ctx, amount)?;

      // Emit bridge-specific event for indexer
        emit!(BridgeBurnEvent {
            from_account: ctx.accounts.from.key(),
            sender: sender,
            recipient: recipient,
            amount,
            timestamp: Clock::get()?.unix_timestamp,
            source_chain: "solana".to_string(),
       
        });

        msg!("Bridge burn completed: {} tokens burned for cross-chain transfer", amount);
    } else {
        // Standard transfer
        let transfer_cpi_accounts = Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };

        let transfer_cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_cpi_accounts,
        );

        token::transfer(transfer_cpi_ctx, amount)?;

        // Emit standard transfer event
        emit!(TokensTransferredEvent {
            from: ctx.accounts.from.key(),
            to: ctx.accounts.to.key(),
            amount,
        });
    }

    Ok(())
}
