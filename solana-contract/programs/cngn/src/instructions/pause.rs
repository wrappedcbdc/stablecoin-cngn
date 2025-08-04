//src/instructions/pause.rs
use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct PauseMint<'info> {
    #[account(
       
        constraint = admin.key() == token_config.admin @ ErrorCode::InvalidAdmin,
    )]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,
}

#[derive(Accounts)]
pub struct PauseTransfer<'info> {
    #[account(
        mut,
        constraint = admin.key() == token_config.admin @ ErrorCode::InvalidAdmin,
    )]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,
}

pub fn pause_mint_handler(
    ctx: Context<PauseMint>,
    pause_mint: bool
) -> Result<()> {
    let token_config = &mut ctx.accounts.token_config;
    
    if pause_mint == token_config.mint_paused {
        // Return error message if the state is already what we're trying to set it to
        return Err(ErrorCode::AlreadyPassedDesiredState.into());
    }
    
    token_config.mint_paused = pause_mint;
    
    // Emit paused event
    emit!(TokenMintingPauseEvent {
        mint: token_config.mint,
        mint_paused: token_config.mint_paused,
    });
    
    Ok(())
}

pub fn pause_transfer_handler(
    ctx: Context<PauseTransfer>,
    pause_transfer: bool
) -> Result<()> {
    let token_config = &mut ctx.accounts.token_config;
    
    if pause_transfer == token_config.transfer_paused {
        // Return error message if the state is already what we're trying to set it to
       
        return Err(ErrorCode::AlreadyPassedDesiredState.into());
    }
    
    token_config.transfer_paused = pause_transfer;
    
    // Emit paused event
    emit!(TokenTransferPauseEvent {
        mint: token_config.mint,
        transfer_paused: token_config.transfer_paused,
    });
    
    Ok(())
}