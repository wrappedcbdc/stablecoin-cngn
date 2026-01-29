// src/instructions/multisig.rs
use crate::errors::ErrorCode;
use crate::events::*;
use crate::state::{multisig as ms, Multisig, TokenConfig, TOKEN_CONFIG_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use std::collections::BTreeSet;
#[derive(Accounts)]
pub struct InitializeMultisig<'info> {
    #[account(
        init,
        payer = payer,
        space = Multisig::space(Multisig::MAX_OWNERS),
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = token_config.admin == payer.key() @ ErrorCode::Unauthorized,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMultisig<'info> {
    #[account(
        mut,
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

// ============================================================================
// Instruction Handlers
// ============================================================================

pub fn initialize_multisig_handler(
    ctx: Context<InitializeMultisig>,
    owners: Vec<Pubkey>,
    threshold: u8,
) -> Result<()> {
    require!(
        owners.len() <= Multisig::MAX_OWNERS,
        ErrorCode::TooManyOwners
    );

    require!(!owners.is_empty(), ErrorCode::NoOwnersProvided);
    let token_config = &mut ctx.accounts.token_config;
    // Check for duplicate owners
    let mut unique_owners = BTreeSet::new();
    for owner in &owners {
        require!(unique_owners.insert(owner), ErrorCode::DuplicateOwners);
    }

    Multisig::assert_valid_threshold(owners.len(), threshold)?;

    let multisig = &mut ctx.accounts.multisig;
    multisig.owners = owners.clone();
    multisig.threshold = threshold;
    multisig.nonce = 0;
    multisig.bump = ctx.bumps.multisig;
    token_config.admin = multisig.key();

    emit!(MultisigInitializedEvent {
    multisig: multisig.key(),
    owners: owners.clone(),
    threshold,
});
    Ok(())
}

pub fn update_multisig_handler(
    ctx: Context<UpdateMultisig>,
    new_owners: Vec<Pubkey>,
    new_threshold: u8,
) -> Result<()> {
    require!(!new_owners.is_empty(), ErrorCode::NoOwnersProvided);

    // Check for duplicate owners
    let mut unique_owners = BTreeSet::new();
    for owner in &new_owners {
        require!(unique_owners.insert(owner), ErrorCode::DuplicateOwners);
    }

    let multisig = &mut ctx.accounts.multisig;

    let message = ms::build_update_multisig_message(
        &multisig.key(),
        &new_owners,
        new_threshold,
        multisig.nonce,
    );

    ms::validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    multisig.rotate_owners(new_owners.clone(), new_threshold)?;

    emit!(MultisigUpdatedEvent {
    multisig: multisig.key(),
    old_owners: multisig.owners.clone(),
    new_owners: new_owners.clone(),
    old_threshold: multisig.threshold,
    new_threshold: new_threshold,
});

    Ok(())
}
