use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Burn, Mint};
use crate::state::*;
use crate::events::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct BurnTokens<'info> {
   
    pub owner: Signer<'info>,
    
    #[account(
        seeds = [b"token-config", mint.key().as_ref()],
        bump = token_config.bump,
        constraint = !token_config.transfer_paused @ ErrorCode::TransfersPaused,
    )]
    pub token_config: Account<'info, TokenConfig>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        constraint = burn_from.owner == owner.key() @ ErrorCode::InvalidOwner,
        constraint = burn_from.mint == mint.key() @ ErrorCode::MintMismatch,
    )]
    pub burn_from: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    let burn_from = ctx.accounts.burn_from.to_account_info();
    let mint = ctx.accounts.mint.to_account_info();
    let owner = ctx.accounts.owner.to_account_info();
    let token_program = ctx.accounts.token_program.to_account_info();
    
    // Burn tokens
    let cpi_accounts = Burn {
        mint,
        from: burn_from,
        authority: owner,
    };
    
    let cpi_ctx = CpiContext::new(
        token_program,
        cpi_accounts,
    );
    
    token::burn(cpi_ctx, amount)?;
    
    // Emit burn event
    emit!(TokensBurnedEvent {
        from: ctx.accounts.burn_from.key(),
        amount,
        owner: ctx.accounts.owner.key(),
    });
    
    Ok(())
}