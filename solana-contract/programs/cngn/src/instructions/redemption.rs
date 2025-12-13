// src/instructions/redemption_transfer.rs
use crate::errors::ErrorCode;
use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
     token_2022::{ TransferChecked},
    token_interface::{self, Burn, Mint, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
pub struct RedemptionTransfer<'info> {
    /// The actual owner must sign to authorize the burn
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
       
        constraint = !token_config.transfer_paused @ ErrorCode::TransfersPaused,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = owner, // Verify owner matches
        constraint = from.owner == owner.key() @ ErrorCode::Unauthorized,
    )]
    pub from: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub to: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
    )]
    pub blacklist: Account<'info, BlackList>,
#[account(
    )]
    pub internal_whitelist: Account<'info, InternalWhiteList>,
#[account(
    )]
    pub external_whitelist: Account<'info, ExternalWhiteList>,

    #[account(
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn redemption_handler(ctx: Context<RedemptionTransfer>, amount: u64) -> Result<()> {
    let sender = ctx.accounts.owner.key();
    let recipient = ctx.accounts.to.owner;
    let mint_key = ctx.accounts.mint.key();
    let bump = ctx.accounts.mint_authority.bump;
    let internal_whitelist = &ctx.accounts.internal_whitelist;
    let external_whitelist = &ctx.accounts.external_whitelist;
    let is_redemption_transfer = external_whitelist.is_whitelisted(&sender)
        && internal_whitelist.is_whitelisted(&recipient);
    if !is_redemption_transfer {
        return Err(ErrorCode::Unauthorized.into());
    }
   
    require!(
        ctx.accounts.from.amount >= amount,
        ErrorCode::InsufficientFunds
    );

    // COMPLIANCE CHECK: Verify the signer is the actual token account owner
    require!(ctx.accounts.from.owner == sender, ErrorCode::Unauthorized);

    // Blacklist checks
    require!(
        !ctx.accounts.blacklist.is_blacklisted(&sender),
        ErrorCode::UserBlacklisted
    );

    require!(
        !ctx.accounts.blacklist.is_blacklisted(&recipient),
        ErrorCode::UserBlacklisted
    );
    let signer_seeds: &[&[&[u8]]] = &[&[MINT_AUTHORITY_SEED, mint_key.as_ref(), &[bump]]];
    // --- 1. TRANSFER: Move tokens from Sender -> Recipient (Signed by Permanent Delegate) ---
    // The PDA is the Permanent Delegate and can transfer from any account.
    let transfer_accounts = TransferChecked {
        from: ctx.accounts.from.to_account_info(),
        to: ctx.accounts.to.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.mint_authority.to_account_info(), // Permanent Delegate signs
    };
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
        signer_seeds,
    );
  token_interface::transfer_checked(transfer_ctx, amount, ctx.accounts.mint.decimals)?;
    // --- 2. BURN: Destroy tokens at the Recipient's account (Signed by Permanent Delegate) ---
    // The PDA can burn from any account (including the recipient's) due to Permanent Delegate authority.
    let signer_seeds: &[&[&[u8]]] = &[&[MINT_AUTHORITY_SEED, mint_key.as_ref(), &[bump]]];

    let burn_accounts = Burn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.to.to_account_info(),
        authority: ctx.accounts.mint_authority.to_account_info(),
    };

    let burn_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        burn_accounts,
        signer_seeds,
    );

    token_interface::burn(burn_ctx, amount)?;

    emit!(RedemptionEvent {
        from: ctx.accounts.from.key(),
        owner: sender,
        to: ctx.accounts.to.key(),
        amount: amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
