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
        seeds = [TOKEN_CONFIG_SEED],
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
         mut,
        seeds = [Multisig::MULTISIG_SEED,  token_config.mint.as_ref()],
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

   
    let can_mint = &mut ctx.accounts.can_mint;


    
    if can_mint.can_mint(&user) {
       return Err(ErrorCode::AlreadyMinter.into());
    }
    // Add to can mint list if not already present
     can_mint.add_authority(&user)?;

        emit!(WhitelistedMinter {
            mint: ctx.accounts.token_config.mint,
            authority: user,
        });

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
            seeds = [TOKEN_CONFIG_SEED],
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
         mut,
        seeds = [Multisig::MULTISIG_SEED,  token_config.mint.as_ref()],
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

    if !can_mint.can_mint(&user) {
      return Err(ErrorCode::UserNotFound.into());
    }

       can_mint.remove_authority(&user)?;

        emit!(BlackListedMinter {
            mint: ctx.accounts.token_config.mint,
            authority: user,
        });

    Ok(())
}



#[derive(Accounts)]
pub struct SetMintAmount<'info> {
    #[account(
         mut,
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
           seeds = [TOKEN_CONFIG_SEED],
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
        build_set_mint_amount_message(&ctx.accounts.can_mint.key(), &user, amount, multisig.nonce);

    validate_multisig_authorization(multisig, &ctx.accounts.instructions, &message)?;

    let can_mint = &mut ctx.accounts.can_mint;

    if !can_mint.can_mint(&user) {
        return Err(ErrorCode::UserNotFound.into());
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
        mut,
        seeds = [Multisig::MULTISIG_SEED,  token_config.mint.as_ref()],
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
           seeds = [TOKEN_CONFIG_SEED],
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
        return Err(ErrorCode::UserNotFound.into());
    }

    can_mint.set_mint_amount(&user, amount)?;
    

    emit!(MintAmountUpdatedEvent {
        mint: ctx.accounts.token_config.mint,
        authority: user,
        amount,
    });

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
            seeds = [TOKEN_CONFIG_SEED],
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
         mut,
        seeds = [Multisig::MULTISIG_SEED,  token_config.mint.as_ref()],
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

  
    let can_forward = &mut ctx.accounts.can_forward;

  

    if can_forward.is_trusted_forwarder(&forwarder) {
     return Err(ErrorCode::AlreadyForwarder.into());
    }

       can_forward.add(&forwarder)?;

        emit!(WhitelistedForwarder {
            mint: ctx.accounts.token_config.mint,
            forwarder,
        });

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
            seeds = [TOKEN_CONFIG_SEED],
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
         mut,
        seeds = [Multisig::MULTISIG_SEED, token_config.mint.as_ref()],
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

    if !can_forward.is_trusted_forwarder(&forwarder) {
        return Err(ErrorCode::NotForwarder.into());

    }

            can_forward.remove(&forwarder)?;

        emit!(BlackListedForwarder {
            mint: ctx.accounts.token_config.mint,
            forwarder,
        });

    Ok(())
}




// ============================================================================
// Non-Multisig Functions 
// ============================================================================

#[derive(Accounts)]
pub struct GetMintAmount<'info> {
        #[account(
       
        constraint = mint.key() == token_config.mint @ ErrorCode::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
            seeds = [TOKEN_CONFIG_SEED],
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
           seeds = [TOKEN_CONFIG_SEED],
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
        mut,
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
       return Err(ErrorCode::AlreadyTrusted.into());
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
            seeds = [TOKEN_CONFIG_SEED],
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
        mut,
        seeds = [Multisig::MULTISIG_SEED,  token_config.mint.as_ref()],
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
       return Err(ErrorCode::NotTrusted.into());
    }

    trusted_contracts.remove(&contract)?;

    emit!(BlackListedContract {
        mint: ctx.accounts.token_config.mint,
        contract,
    });

    Ok(())
}

