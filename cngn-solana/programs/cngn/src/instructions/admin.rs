// instructions/admin.rs
use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::errors::ErrorCode;
use anchor_spl::token_interface::{BurnChecked, Mint,burn_checked ,Token2022, TokenAccount};

#[derive(Accounts)]
pub struct AddCanMint<'info> {
    #[account(
        mut,
        constraint = (
            authority.key() == token_config.admin || 
            trusted_contracts.is_trusted_contract(&authority.key())
        ) @ ErrorCode::Unauthorized
      
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
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
}

pub fn add_can_mint_handler(ctx: Context<AddCanMint>, user: Pubkey) -> Result<()> {
    let blacklist = &ctx.accounts.blacklist;
    let can_mint = &mut ctx.accounts.can_mint;
    
    // Check if the account is blacklisted
    if blacklist.is_blacklisted(&user) {
        return Err(ErrorCode::UserBlacklisted.into());
       
    }
    
    // Add to can mint list if not already present
    if !can_mint.can_mint(&user) {
        can_mint.add_authority(&user)?;
        
        // Emit can mint added event
        emit!(WhitelistedMinter {
            mint: ctx.accounts.token_config.mint,
            authority: user,
        });
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct RemoveCanMint<'info> {
    #[account(
        mut,
            constraint = (
            authority.key() == token_config.admin || 
            trusted_contracts.is_trusted_contract(&authority.key())
        ) @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
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
}

pub fn remove_can_mint_handler(ctx: Context<RemoveCanMint>, user: Pubkey) -> Result<()> {
    let can_mint = &mut ctx.accounts.can_mint;
    
    // Check if the account is in the can mint list
    if can_mint.can_mint(&user) {
        can_mint.remove_authority(&user)?;
        
        // Emit can mint removed event
        emit!(BlackListedMinter {
            mint: ctx.accounts.token_config.mint,
            authority: user,
        });
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct SetMintAmount<'info> {
    // Only contract admin can call this
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [CAN_MINT_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,

}

pub fn set_mint_amount_handler(ctx: Context<SetMintAmount>, user: Pubkey, amount: u64) -> Result<()> {

    
    // Or validate against a minimum and maximum
    if amount < token_config::MIN_MINT_AMOUNT 
   // || amount > token_config::MAX_MINT_AMOUNT 
    {
        return Err(ErrorCode::InvalidMintAmount.into());
    }
    let can_mint = &mut ctx.accounts.can_mint;
    
    // Check if the authority exists in the can_mint list
    if !can_mint.can_mint(&user) {
        return Err(ErrorCode::AdminNotFound.into());
    }

    // Update the mint amount for the specified authority
    can_mint.set_mint_amount(&user, amount)?;

    // Emit mint amount updated event
    emit!(MintAmountUpdatedEvent {
        mint: ctx.accounts.token_config.mint,
        authority: user,
        amount,
    });

    Ok(())
}


#[derive(Accounts)]
pub struct RemoveMintAmount<'info> {
    // Only contract admin can call this
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [CAN_MINT_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,
}

pub fn remove_mint_amount_handler(ctx: Context<RemoveMintAmount>, user: Pubkey) -> Result<()> {

    let amount:u64=0;
   
    let can_mint = &mut ctx.accounts.can_mint;
    
    // Check if the authority exists in the can_mint list
    if !can_mint.can_mint(&user) {
        return Err(ErrorCode::AdminNotFound.into());
    }

    // Update the mint amount for the specified authority
    can_mint.set_mint_amount(&user, amount)?;

    // Emit mint amount updated event
    emit!(MintAmountUpdatedEvent {
        mint: ctx.accounts.token_config.mint,
        authority: user,
        amount,
    });

    Ok(())
}


#[derive(Accounts)]
pub struct GetMintAmount<'info> {
 

    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
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
    
    // Check if the authority exists in the can_mint list
    if !can_mint.can_mint(&user) {
        return Err(ErrorCode::UserNotFound.into());
    }

    // Get the mint amount for the specified authority
    can_mint.get_mint_amount(&user)
}

#[derive(Accounts)]
pub struct AddBlackList<'info> {
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
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
}

pub fn add_blacklist_handler(ctx: Context<AddBlackList>,user: Pubkey) -> Result<()> {
    let blacklist = &mut ctx.accounts.blacklist;
let can_mint = &mut ctx.accounts.can_mint;
    let internal_whitelist =&mut ctx.accounts.internal_whitelist;
    let external_whitelist = &mut ctx.accounts.external_whitelist;
    let trusted_contracts = &mut ctx.accounts.trusted_contracts;
    let can_forward = &mut ctx.accounts.can_forward;
// Check if the account is already blacklisted
if blacklist.is_blacklisted(&user) {
    return Err(ErrorCode::UserBlacklisted.into());
}

// Add account to blacklist
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


if  trusted_contracts.is_trusted_contract(&user) {
    trusted_contracts.remove(&user)?;
}
    
    // Emit blacklisted event
    emit!(AddedBlackList {
        mint: ctx.accounts.token_config.mint,
        user,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct RemoveBlackList<'info> {
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [BLACK_LIST_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,
}

pub fn remove_blacklist_handler(ctx: Context<RemoveBlackList>,user: Pubkey) -> Result<()> {
    let blacklist = &mut ctx.accounts.blacklist;
 
    
    // Check if the account is not blacklisted
    if !blacklist.is_blacklisted(&user) {
        return Ok(());
    }
    
    // Remove account from blacklist
    blacklist.remove(&user)?;
    
    // Emit remove from blacklist event
    emit!(RemovedBlackList {
        mint: ctx.accounts.token_config.mint,
        user,
    });
    
    Ok(())
}



#[derive(Accounts)]
pub struct AddTrustedContract<'info> {
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,

   

    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [TRUSTED_CONTRACTS_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

}

pub fn add_trusted_contract_handler(ctx: Context<AddTrustedContract>,contract:Pubkey) -> Result<()> {
    let trusted_contracts = &mut ctx.accounts.trusted_contracts;
  
    // Check if the contract is already in the trusted list
    if trusted_contracts.is_trusted_contract(&contract) {
        return Ok(());
    }
    
    // Add contract to trusted list
    trusted_contracts.add(&contract)?;
    
    // Emit trusted contract added event
    emit!(WhitelistedContract {
        mint: ctx.accounts.token_config.mint,
        contract,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct RemoveTrustedContract<'info> {
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,



    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [TRUSTED_CONTRACTS_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,
}

pub fn remove_trusted_contract_handler(ctx: Context<RemoveTrustedContract>,contract:Pubkey) -> Result<()> {
    let trusted_contracts = &mut ctx.accounts.trusted_contracts;

    
    // Check if the contract is in the trusted list
    if !trusted_contracts.is_trusted_contract(&contract) {
        return Ok(());
    }
    
    // Remove contract from trusted list
    trusted_contracts.remove(&contract)?;
    
    // Emit trusted contract removed event
    emit!(BlackListedContract {
        mint: ctx.accounts.token_config.mint,
        contract,
    });
    
    Ok(())
}



#[derive(Accounts)]
pub struct WhitelistInternalUser<'info> {
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,


    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
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


}

pub fn whitelist_internal_user_handler(ctx: Context<WhitelistInternalUser>,user:Pubkey) -> Result<()> {
    let internal_whitelist = &mut ctx.accounts.internal_whitelist;
    let blacklist = &ctx.accounts.blacklist;

    
    // Check if the account is blacklisted
    if blacklist.is_blacklisted(&user) {
        return Err(ErrorCode::UserBlacklisted.into());
       
    }
    
    // Check if the account is already whitelisted
    if internal_whitelist.is_whitelisted(&user) {
        return Ok(());
    }
    
    // Add to internal whitelist
    internal_whitelist.add(&user)?;
    
    // Emit event
    emit!(WhitelistedInternalUser {
        mint: ctx.accounts.token_config.mint,
        user: user
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct WhitelistExternalUser<'info> {
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,


    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
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
}

pub fn whitelist_external_user_handler(ctx: Context<WhitelistExternalUser>,user:Pubkey) -> Result<()> {
    let external_whitelist = &mut ctx.accounts.external_whitelist;

    let blacklist = &ctx.accounts.blacklist;
   
    
    // Check if the account is blacklisted
    if blacklist.is_blacklisted(&user) {
        return Err(ErrorCode::UserBlacklisted.into());
       
    }
    // Check if the account is already whitelisted
    if external_whitelist.is_whitelisted(&user) {
        return Ok(());
    }
    
    // Add to external whitelist
    external_whitelist.add(&user)?;
    
    // Emit event
    emit!(WhitelistedExternalSender {
        mint: ctx.accounts.token_config.mint,
        user: user,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct BlacklistInternalUser<'info> {
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,


    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
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
}

pub fn blacklist_internal_user_handler(ctx: Context<BlacklistInternalUser>,user:Pubkey) -> Result<()> {
    let internal_whitelist = &mut ctx.accounts.internal_whitelist;
   
    
    // Check if the account is not on the whitelist
    if !internal_whitelist.is_whitelisted(&user) {
        return Ok(());
    }
    
    // Remove from internal whitelist
    internal_whitelist.remove(&user)?;
    
    // Emit event
    emit!(BlackListedInternalUser {
        mint: ctx.accounts.token_config.mint,
        user: user,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct BlacklistExternalUser<'info> {
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,


    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"external-whitelist", token_config.mint.as_ref()],
        bump,
    )]
    pub external_whitelist: Account<'info, ExternalWhiteList>,
}

pub fn blacklist_external_user_handler(ctx: Context<BlacklistExternalUser>,user:Pubkey) -> Result<()> {
    let external_whitelist = &mut ctx.accounts.external_whitelist;
  
    
    // Check if the account is not on the whitelist
    if !external_whitelist.is_whitelisted(&user) {
        return Ok(());
    }
    
    // Remove from external whitelist
    external_whitelist.remove(&user)?;
    
    // Emit event
    emit!(BlackListedExternalSender {
        mint: ctx.accounts.token_config.mint,
        user: user,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct AddCanForward<'info> {
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
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
}

pub fn add_can_forward_handler(ctx: Context<AddCanForward>, forwarder: Pubkey) -> Result<()> {
    let blacklist = &ctx.accounts.blacklist;
    let can_forward = &mut ctx.accounts.can_forward;

    
    // Check if the account is blacklisted
    if blacklist.is_blacklisted(&forwarder) {
        return Err(ErrorCode::UserBlacklisted.into());
       
    }
    // Add to can forward list if not already present
    if !can_forward.is_trusted_forwarder(&forwarder) {
        can_forward.add(&forwarder)?;
        
        // Emit can forward added event
        emit!(WhitelistedForwarder {
            mint: ctx.accounts.token_config.mint,
            forwarder,
        });
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct RemoveCanForward<'info> {
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"can-forward", token_config.mint.as_ref()],
        bump,
    )]
    pub can_forward: Account<'info, CanForward>,
}

pub fn remove_can_forward_handler(ctx: Context<RemoveCanForward>, forwarder: Pubkey) -> Result<()> {
    let can_forward = &mut ctx.accounts.can_forward;
    
    // Check if the forwarder is in the can forward list
    if can_forward.is_trusted_forwarder(&forwarder) {
        can_forward.remove(&forwarder)?;
        
        // Emit can forward removed event
        emit!(BlackListedForwarder {
            mint: ctx.accounts.token_config.mint,
            forwarder,
        });
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct ChangeAdmin<'info> {
    // Current admin or trusted contract must sign to authorize the change
    #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized
        
    )]
    pub authority: Signer<'info>,

    // The TokenConfig account to update the admin field
    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, token_config.mint.as_ref()],
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
}


pub fn change_admin_handler(ctx: Context<ChangeAdmin>, new_admin: Pubkey) -> Result<()> {
    let token_config = &mut ctx.accounts.token_config;
    let blacklist = &ctx.accounts.blacklist;

    // 1. Security Check: Prevent setting the admin to a blacklisted address.
    if blacklist.is_blacklisted(&new_admin) {
        return Err(ErrorCode::UserBlacklisted.into());
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


#[derive(Accounts)]
pub struct DestroyBlackTokens<'info> {

     /// Authority that can destroy black funds (should be admin)
     #[account(
        mut,
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,
    #[account(
        seeds = [MINT_AUTHORITY_SEED, mint.key().as_ref()],
        bump = mint_authority.bump,
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub evil_user: InterfaceAccount<'info, TokenAccount>,


    #[account(
        seeds = [BLACK_LIST_SEED, token_config.mint.as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    pub token_program: Program<'info, Token2022>,
}

pub fn destroy_black_funds_handler(ctx: Context<DestroyBlackTokens>, amount: u64) -> Result<()> {
    let mint = &ctx.accounts.mint;
    let from = &ctx.accounts.evil_user;
    let token_config = &ctx.accounts.token_config;
    let mint_authority = &ctx.accounts.mint_authority;
    let blacklist = &ctx.accounts.blacklist;
    // Check if the token account owner is blacklisted
    require!(
        blacklist.is_blacklisted(&from.owner),
        ErrorCode::NotBlacklisted
    );
    // Prepare PDA seeds for signing
    let mint_key = mint.key();
    let seeds = &[
        MINT_AUTHORITY_SEED,
        mint_key.as_ref(),
        &[mint_authority.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Create CPI context for burn_checked
    // Using burn_checked instead of burn for additional safety
    let cpi_accounts = BurnChecked {
        mint: mint.to_account_info(),
        from: from.to_account_info(),
        authority: mint_authority.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

    // Perform the burn
    burn_checked(cpi_ctx, amount, token_config.decimals)?;

    // Emit burn event
    emit!(DestroyedBlackFundsEvent {
        mint: mint.key(),
        from: from.key(),
        amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}