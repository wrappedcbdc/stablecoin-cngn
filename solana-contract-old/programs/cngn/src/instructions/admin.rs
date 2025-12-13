// instructions/admin.rs
use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct AddCanMint<'info> {
    #[account(
     
        constraint = (
            authority.key() == token_config.admin || 
            trusted_contracts.is_trusted_contract(&authority.key())
        ) @ ErrorCode::Unauthorized
      
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        seeds = [b"blacklist", token_config.mint.as_ref()],
        bump,
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        mut,
        seeds = [b"can-mint", token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,

    #[account(
        seeds = [b"trusted-contracts", token_config.mint.as_ref()],
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
        emit!(WhitelistedMinterEvent {
            mint: ctx.accounts.token_config.mint,
            authority: user,
        });
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct RemoveCanMint<'info> {
    #[account(
    
            constraint = (
            authority.key() == token_config.admin || 
            trusted_contracts.is_trusted_contract(&authority.key())
        ) @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"can-mint", token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,

    #[account(
        seeds = [b"trusted-contracts", token_config.mint.as_ref()],
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
        emit!(BlackListedMinterEvent {
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
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"can-mint", token_config.mint.as_ref()],
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
        return Err(ErrorCode::NotMinter.into());
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
        
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"can-mint", token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,
}

pub fn remove_mint_amount_handler(ctx: Context<RemoveMintAmount>, user: Pubkey) -> Result<()> {

    let amount:u64=0;
   
    let can_mint = &mut ctx.accounts.can_mint;
    
    // Check if the authority exists in the can_mint list
    if !can_mint.can_mint(&user) {
        return Err(ErrorCode::NotMinter.into());
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
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        seeds = [b"can-mint", token_config.mint.as_ref()],
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
       
        constraint = authority.key() == token_config.admin @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,
    #[account(
        mut,
        seeds = [b"can-mint", token_config.mint.as_ref()],
        bump,
    )]
    pub can_mint: Account<'info, CanMint>,
    
    #[account(
        mut,
        seeds = [b"internal-whitelist", token_config.mint.as_ref()],
        bump,
    )]
    pub internal_whitelist: Account<'info, InternalWhiteList>,
    
    #[account(
         mut,
        seeds = [b"external-whitelist", token_config.mint.as_ref()],
        bump,
    )]
    pub external_whitelist: Account<'info, ExternalWhiteList>,
    
    #[account(
         mut,
        seeds = [b"trusted-contracts", token_config.mint.as_ref()],
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
        seeds = [b"blacklist", token_config.mint.as_ref()],
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
    emit!(AddedBlackListEvent {
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
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"blacklist", token_config.mint.as_ref()],
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
    emit!(RemovedBlackListEvent {
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
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"trusted-contracts", token_config.mint.as_ref()],
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
    emit!(WhitelistedContractEvent {
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
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"trusted-contracts", token_config.mint.as_ref()],
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
    emit!(BlackListedContractEvent {
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
        seeds = [b"token-config", token_config.mint.as_ref()],
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
        seeds = [b"blacklist", token_config.mint.as_ref()],
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
    emit!(WhitelistedInternalUserEvent {
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
        seeds = [b"token-config", token_config.mint.as_ref()],
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
        seeds = [b"blacklist", token_config.mint.as_ref()],
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
    emit!(WhitelistedExternalSenderEvent {
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
        seeds = [b"token-config", token_config.mint.as_ref()],
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
        seeds = [b"trusted-contracts", token_config.mint.as_ref()],
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
    emit!(BlackListedInternalUserEvent {
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
        seeds = [b"token-config", token_config.mint.as_ref()],
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
    emit!(BlackListedExternalSenderEvent {
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
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        seeds = [b"blacklist", token_config.mint.as_ref()],
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
        emit!(WhitelistedForwarderEvent {
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
        seeds = [b"token-config", token_config.mint.as_ref()],
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
        emit!(BlackListedForwarderEvent {
            mint: ctx.accounts.token_config.mint,
            forwarder,
        });
    }
    
    Ok(())
}