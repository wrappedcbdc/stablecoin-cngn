//src/instructions/pause.rs
use crate::errors::ErrorCode;
use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct PauseMint<'info> {
    #[account(
        mut,
        seeds = [Multisig::MULTISIG_SEED,token_config.mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        mut,
    seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn pause_mint_handler(ctx: Context<PauseMint>, pause_mint: bool) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    let message =
        build_pause_mint_message(&ctx.accounts.token_config.key(), pause_mint, multisig.nonce);

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;
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
