// instructions/admin.rs
use crate::errors::ErrorCode;
use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

// ============================================================================
// Add Can Mint (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct AddCanMint<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        seeds = [BLACK_LIST_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        mut,
        seeds = [CAN_MINT_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,

    #[account(
        seeds = [TRUSTED_CONTRACTS_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn add_can_mint_handler(ctx: Context<AddCanMint>, user: Pubkey) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    // Verify multisig is the admin
    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    // Build the message for multisig validation
    let message = build_add_can_mint_message(&ctx.accounts.can_mint.key(), &user, multisig.nonce);

    // Validate multisig authorization
    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let blacklist = &ctx.accounts.blacklist;
    let can_mint = &mut ctx.accounts.can_mint;

    // Check if the account is blacklisted
    if blacklist.is_blacklisted(&user) {
        return Err(ErrorCode::UserBlacklisted.into());
    }

    // Add to can mint list if not already present
    if !can_mint.can_mint(&user) {
        can_mint.add_authority(&user)?;

        emit!(WhitelistedMinter {
            mint: ctx.accounts.token_config.mint,
            authority: user,
        });
    }

    Ok(())
}

// ============================================================================
// Remove Can Mint (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct RemoveCanMint<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [CAN_MINT_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,

    #[account(
        seeds = [TRUSTED_CONTRACTS_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn remove_can_mint_handler(ctx: Context<RemoveCanMint>, user: Pubkey) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message =
        build_remove_can_mint_message(&ctx.accounts.can_mint.key(), &user, multisig.nonce);

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let can_mint = &mut ctx.accounts.can_mint;

    if can_mint.can_mint(&user) {
        can_mint.remove_authority(&user)?;

        emit!(BlackListedMinter {
            mint: ctx.accounts.token_config.mint,
            authority: user,
        });
    }

    Ok(())
}

// ============================================================================
// Add Can Forward (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct AddCanForward<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        seeds = [BLACK_LIST_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        mut,
        seeds = [b"can-forward", token_config.mint.as_ref()],
        bump,
    )]
    pub can_forward: Account<'info, CanForward>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn add_can_forward_handler(ctx: Context<AddCanForward>, forwarder: Pubkey) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message =
        build_add_can_forward_message(&ctx.accounts.can_forward.key(), &forwarder, multisig.nonce);

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let blacklist = &ctx.accounts.blacklist;
    let can_forward = &mut ctx.accounts.can_forward;

    if blacklist.is_blacklisted(&forwarder) {
        return Err(ErrorCode::UserBlacklisted.into());
    }

    if !can_forward.is_trusted_forwarder(&forwarder) {
        can_forward.add(&forwarder)?;

        emit!(WhitelistedForwarder {
            mint: ctx.accounts.token_config.mint,
            forwarder,
        });
    }

    Ok(())
}

// ============================================================================
// Remove Can Forward (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct RemoveCanForward<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"can-forward", token_config.mint.as_ref()],
        bump,
    )]
    pub can_forward: Account<'info, CanForward>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn remove_can_forward_handler(ctx: Context<RemoveCanForward>, forwarder: Pubkey) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message = build_remove_can_forward_message(
        &ctx.accounts.can_forward.key(),
        &forwarder,
        multisig.nonce,
    );

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let can_forward = &mut ctx.accounts.can_forward;

    if can_forward.is_trusted_forwarder(&forwarder) {
        can_forward.remove(&forwarder)?;

        emit!(BlackListedForwarder {
            mint: ctx.accounts.token_config.mint,
            forwarder,
        });
    }

    Ok(())
}

// ============================================================================
// Add Blacklist (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct AddBlackList<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        seeds = [CAN_MINT_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,

    #[account(
        seeds = [b"internal-whitelist", token_config.mint.as_ref()],
        bump,
    )]
    pub internal_whitelist: Account<'info, InternalWhiteList>,

    #[account(
        seeds = [b"external-whitelist", token_config.mint.as_ref()],
        bump,
    )]
    pub external_whitelist: Account<'info, ExternalWhiteList>,

    #[account(
        seeds = [TRUSTED_CONTRACTS_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    #[account(
        mut,
        seeds = [b"can-forward", token_config.mint.as_ref()],
        bump,
    )]
    pub can_forward: Account<'info, CanForward>,

    #[account(
        mut,
        seeds = [BLACK_LIST_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn add_blacklist_handler(ctx: Context<AddBlackList>, user: Pubkey) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message = build_add_blacklist_message(&ctx.accounts.blacklist.key(), &user, multisig.nonce);

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let blacklist = &mut ctx.accounts.blacklist;
    let can_mint = &mut ctx.accounts.can_mint;
    let internal_whitelist = &mut ctx.accounts.internal_whitelist;
    let external_whitelist = &mut ctx.accounts.external_whitelist;
    let trusted_contracts = &mut ctx.accounts.trusted_contracts;
    let can_forward = &mut ctx.accounts.can_forward;

    if blacklist.is_blacklisted(&user) {
        return Err(ErrorCode::UserBlacklisted.into());
    }

    blacklist.add(&user)?;

    // Remove user from other lists if present
    if can_mint.can_mint(&user) {
        can_mint.remove_authority(&user)?;
    }
    if internal_whitelist.is_whitelisted(&user) {
        internal_whitelist.remove(&user)?;
    }
    if external_whitelist.is_whitelisted(&user) {
        external_whitelist.remove(&user)?;
    }
    if can_forward.is_trusted_forwarder(&user) {
        can_forward.remove(&user)?;
    }
    if trusted_contracts.is_trusted_contract(&user) {
        trusted_contracts.remove(&user)?;
    }

    emit!(AddedBlackList {
        mint: ctx.accounts.token_config.mint,
        user,
    });

    Ok(())
}

// ============================================================================
// Remove Blacklist (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct RemoveBlackList<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [BLACK_LIST_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn remove_blacklist_handler(ctx: Context<RemoveBlackList>, user: Pubkey) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message =
        build_remove_blacklist_message(&ctx.accounts.blacklist.key(), &user, multisig.nonce);

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let blacklist = &mut ctx.accounts.blacklist;

    if !blacklist.is_blacklisted(&user) {
        return Ok(());
    }

    blacklist.remove(&user)?;

    emit!(RemovedBlackList {
        mint: ctx.accounts.token_config.mint,
        user,
    });

    Ok(())
}

// ============================================================================
// Non-Multisig Functions (Keep these for backward compatibility or non-critical ops)
// ============================================================================

#[derive(Accounts)]
pub struct SetMintAmount<'info> {
    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [CAN_MINT_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,
    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn set_mint_amount_handler(
    ctx: Context<SetMintAmount>,
    user: Pubkey,
    amount: u64,
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;
    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message =
        build_set_mint_amount_message(&ctx.accounts.can_mint.key(), &user, multisig.nonce);

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let can_mint = &mut ctx.accounts.can_mint;

    if !can_mint.can_mint(&user) {
        return Err(ErrorCode::AdminNotFound.into());
    }

    can_mint.set_mint_amount(&user, amount)?;

    emit!(MintAmountUpdatedEvent {
        mint: ctx.accounts.token_config.mint,
        authority: user,
        amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RemoveMintAmount<'info> {
    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [CAN_MINT_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,
    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn remove_mint_amount_handler(ctx: Context<RemoveMintAmount>, user: Pubkey) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;
    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );
    let message =
        build_remove_mint_amount_message(&ctx.accounts.can_mint.key(), &user, multisig.nonce);

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let can_mint = &mut ctx.accounts.can_mint;
    let amount: u64 = 0;

    if !can_mint.can_mint(&user) {
        return Err(ErrorCode::AdminNotFound.into());
    }

    can_mint.set_mint_amount(&user, amount)?;

    emit!(MintAmountUpdatedEvent {
        mint: ctx.accounts.token_config.mint,
        authority: user,
        amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct GetMintAmount<'info> {
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        seeds = [CAN_MINT_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,
}

pub fn get_mint_amount_handler(ctx: Context<GetMintAmount>, user: Pubkey) -> Result<u64> {
    let can_mint = &ctx.accounts.can_mint;

    if !can_mint.can_mint(&user) {
        return Err(ErrorCode::UserNotFound.into());
    }

    return can_mint.get_mint_amount(&user);
}

// ============================================================================
// Add Trusted Contract (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct AddTrustedContract<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [TRUSTED_CONTRACTS_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn add_trusted_contract_handler(
    ctx: Context<AddTrustedContract>,
    contract: Pubkey,
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message = build_add_trusted_contract_message(
        &ctx.accounts.trusted_contracts.key(),
        &contract,
        multisig.nonce,
    );

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let trusted_contracts = &mut ctx.accounts.trusted_contracts;

    if trusted_contracts.is_trusted_contract(&contract) {
        return Ok(());
    }

    trusted_contracts.add(&contract)?;

    emit!(WhitelistedContract {
        mint: ctx.accounts.token_config.mint,
        contract,
    });

    Ok(())
}

// ============================================================================
// Remove Trusted Contract (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct RemoveTrustedContract<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [TRUSTED_CONTRACTS_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn remove_trusted_contract_handler(
    ctx: Context<RemoveTrustedContract>,
    contract: Pubkey,
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message = build_remove_trusted_contract_message(
        &ctx.accounts.trusted_contracts.key(),
        &contract,
        multisig.nonce,
    );

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let trusted_contracts = &mut ctx.accounts.trusted_contracts;

    if !trusted_contracts.is_trusted_contract(&contract) {
        return Ok(());
    }

    trusted_contracts.remove(&contract)?;

    emit!(BlackListedContract {
        mint: ctx.accounts.token_config.mint,
        contract,
    });

    Ok(())
}

// ============================================================================
// Whitelist Internal User (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct WhitelistInternalUser<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"internal-whitelist", token_config.mint.as_ref()],
        bump,
    )]
    pub internal_whitelist: Account<'info, InternalWhiteList>,

    #[account(
        seeds = [BLACK_LIST_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn whitelist_internal_user_handler(
    ctx: Context<WhitelistInternalUser>,
    user: Pubkey,
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message = build_whitelist_internal_message(
        &ctx.accounts.internal_whitelist.key(),
        &user,
        multisig.nonce,
    );

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let internal_whitelist = &mut ctx.accounts.internal_whitelist;
    let blacklist = &ctx.accounts.blacklist;

    if blacklist.is_blacklisted(&user) {
        return Err(ErrorCode::UserBlacklisted.into());
    }

    if internal_whitelist.is_whitelisted(&user) {
        return Ok(());
    }

    internal_whitelist.add(&user)?;

    emit!(WhitelistedInternalUser {
        mint: ctx.accounts.token_config.mint,
        user: user
    });

    Ok(())
}

// ============================================================================
// Whitelist External User (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct WhitelistExternalUser<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"external-whitelist", token_config.mint.as_ref()],
        bump,
    )]
    pub external_whitelist: Account<'info, ExternalWhiteList>,

    #[account(
        seeds = [BLACK_LIST_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn whitelist_external_user_handler(
    ctx: Context<WhitelistExternalUser>,
    user: Pubkey,
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message = build_whitelist_external_message(
        &ctx.accounts.external_whitelist.key(),
        &user,
        multisig.nonce,
    );

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let external_whitelist = &mut ctx.accounts.external_whitelist;
    let blacklist = &ctx.accounts.blacklist;

    if blacklist.is_blacklisted(&user) {
        return Err(ErrorCode::UserBlacklisted.into());
    }

    if external_whitelist.is_whitelisted(&user) {
        return Ok(());
    }

    external_whitelist.add(&user)?;

    emit!(WhitelistedExternalSender {
        mint: ctx.accounts.token_config.mint,
        user: user,
    });

    Ok(())
}

// ============================================================================
// Blacklist Internal User (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct BlacklistInternalUser<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"internal-whitelist", token_config.mint.as_ref()],
        bump,
    )]
    pub internal_whitelist: Account<'info, InternalWhiteList>,

    #[account(
        seeds = [TRUSTED_CONTRACTS_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn blacklist_internal_user_handler(
    ctx: Context<BlacklistInternalUser>,
    user: Pubkey,
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message = build_blacklist_internal_message(
        &ctx.accounts.internal_whitelist.key(),
        &user,
        multisig.nonce,
    );

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let internal_whitelist = &mut ctx.accounts.internal_whitelist;

    if !internal_whitelist.is_whitelisted(&user) {
        return Ok(());
    }

    internal_whitelist.remove(&user)?;

    emit!(BlackListedInternalUser {
        mint: ctx.accounts.token_config.mint,
        user: user,
    });

    Ok(())
}

// ============================================================================
// Blacklist External User (with Multisig)
// ============================================================================

#[derive(Accounts)]
pub struct BlacklistExternalUser<'info> {
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"external-whitelist", token_config.mint.as_ref()],
        bump,
    )]
    pub external_whitelist: Account<'info, ExternalWhiteList>,

    #[account(
        seeds = [Multisig::MULTISIG_SEED, mint.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: This is the instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn blacklist_external_user_handler(
    ctx: Context<BlacklistExternalUser>,
    user: Pubkey,
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require_keys_eq!(
        multisig.key(),
        ctx.accounts.token_config.admin,
        ErrorCode::Unauthorized
    );

    let message = build_blacklist_external_message(
        &ctx.accounts.external_whitelist.key(),
        &user,
        multisig.nonce,
    );

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let external_whitelist = &mut ctx.accounts.external_whitelist;

    if !external_whitelist.is_whitelisted(&user) {
        return Ok(());
    }

    external_whitelist.remove(&user)?;

    emit!(BlackListedExternalSender {
        mint: ctx.accounts.token_config.mint,
        user: user,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ChangeAdmin<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
       seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    // Trusted Contracts list is needed to validate if a contract is calling this on behalf of the admin
    #[account(
        seeds = [TRUSTED_CONTRACTS_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    // Blacklist is included to prevent transferring admin rights to a blacklisted user
    #[account(
        seeds = [BLACK_LIST_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,
    // #[account(address = instructions::ID)]
    // pub instructions: UncheckedAccount<'info>,
}

pub fn change_admin_handler(ctx: Context<ChangeAdmin>, new_admin: Pubkey) -> Result<()> {
    let token_config = &mut ctx.accounts.token_config;
    let blacklist = &ctx.accounts.blacklist;
    require_keys_eq!(
        ctx.accounts.authority.key(),
        token_config.admin,
        ErrorCode::Unauthorized
    );
    // token_config.validate_caller(
    //         &ctx.accounts.authority,
    //         &ctx.accounts.instructions,
    // )?;

    // 1. Security Check: Prevent setting the admin to a blacklisted address.
    if blacklist.is_blacklisted(&new_admin) {
        return Err(ErrorCode::UserBlacklisted.into());
    }
    if token_config.admin != ctx.accounts.authority.key() {
        return Err(ErrorCode::Unauthorized.into());
    }

    // 2. Prevent self-assignment (no change)
    if token_config.admin == new_admin {
        return Ok(());
    }

    // Capture the old admin key for the event
    let old_admin = token_config.admin;

    // 3. Execute the change
    token_config.admin = new_admin;

    // 4. Emit the event
    emit!(AdminChangedEvent {
        mint: token_config.mint,
        old_admin: old_admin,
        new_admin: new_admin,
        authority: ctx.accounts.authority.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
