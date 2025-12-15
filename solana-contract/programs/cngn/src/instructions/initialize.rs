// instructions/initialize.rs
use crate::errors::ErrorCode;
use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, };

use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;
use anchor_spl::{
    associated_token::{
        spl_associated_token_account::instruction::*,
      
    },
    token_2022::{
        
        Token2022,
    },

};
// Split the accounts into multiple contexts to reduce stack usage
#[derive(Accounts)]
#[instruction(name: String, symbol: String,uri: String, decimals: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    /// CHECK: extra metas account
    #[account(mut)]
    pub admin: UncheckedAccount<'info>,

    #[account(
        init,
        payer = initializer,
        space = TokenConfig::LEN,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = initializer,
        space = MintAuthority::LEN,
        seeds = [MINT_AUTHORITY_SEED, mint.key().as_ref()],
        bump
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    #[account(
        mut,
    //     init,
    //     payer = initializer,
    //     mint::decimals = decimals,
    //     mint::authority = mint_authority.key(),
    //     mint::freeze_authority = mint_authority.key(),
    //     extensions::permanent_delegate::delegate = mint_authority.key(),
    //    // extensions::transfer_hook::authority = mint_authority.key(),
    //    // extensions::transfer_hook::program_id = crate::id(),
    //     extensions::metadata_pointer::authority = mint_authority.key(),
    //     extensions::metadata_pointer::metadata_address = mint.key(),
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        space = get_meta_list_size()?,
        seeds = [META_LIST_ACCOUNT_SEED, mint.key().as_ref()],
        bump,
        payer = initializer,
    )]
    /// CHECK: extra metas account
    pub extra_metas_account: UncheckedAccount<'info>,

    #[account(
        init,
        payer = initializer,
        space = CanMint::space(100),
        seeds = [CAN_MINT_SEED, mint.key().as_ref()],
        bump
    )]
    pub can_mint: Account<'info, CanMint>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// Secondary accounts context to split the initialization
#[derive(Accounts)]
pub struct InitializeSecondary<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = initializer,
        space = TrustedContracts::space(50),
        seeds = [TRUSTED_CONTRACTS_SEED, mint.key().as_ref()],
        bump
    )]
    pub trusted_contracts: Account<'info, TrustedContracts>,

    #[account(
        init,
        payer = initializer,
        space = BlackList::space(100),
        seeds = [BLACK_LIST_SEED, mint.key().as_ref()],
        bump
    )]
    pub blacklist: Account<'info, BlackList>,

    #[account(
        init,
        payer = initializer,
        space = CanForward::space(100),
        seeds = [CAN_FORWARD_SEED, mint.key().as_ref()],
        bump
    )]
    pub can_forward: Account<'info, CanForward>,

    pub system_program: Program<'info, System>,
}

// Third accounts context for the remaining accounts
#[derive(Accounts)]
pub struct InitializeThird<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    // The Extra Metas Account to be populated
    #[account(
        mut,
        seeds = [META_LIST_ACCOUNT_SEED, mint.key().as_ref()],
        bump,
    )]
    /// CHECK: extra metas account
    pub extra_metas_account: UncheckedAccount<'info>,

    // TokenConfig is needed as a reference in the Meta List
    #[account(
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = initializer,
        space = ExternalWhiteList::space(100),
        seeds = [EXTERNAL_WHITELIST_SEED, mint.key().as_ref()],
        bump
    )]
    pub external_whitelist: Account<'info, ExternalWhiteList>,

    #[account(
        init,
        payer = initializer,
        space = InternalWhiteList::space(100),
        seeds = [INTERNAL_WHITELIST_SEED, mint.key().as_ref()],
        bump
    )]
    pub internal_whitelist: Account<'info, InternalWhiteList>,

    pub system_program: Program<'info, System>,
}

// Primary initialization handler
pub fn initialize_handler(
    ctx: Context<Initialize>,
    name: String,
    symbol: String,
    uri: String,
    decimals: u8,
) -> Result<()> {
    let token_config = &mut ctx.accounts.token_config;
    let mint = &ctx.accounts.mint;
    let can_mint = &mut ctx.accounts.can_mint;
    let mint_authority = &mut ctx.accounts.mint_authority;

    // Set token config data
    token_config.name = name.clone();
    token_config.symbol = symbol.clone();
    token_config.decimals = decimals;
    token_config.mint = mint.key();
    token_config.admin = ctx.accounts.admin.key();
    token_config.mint_paused = false;
    token_config.transfer_paused = false;
    token_config.bump = ctx.bumps.token_config;

    // Initialize mint authority data
    mint_authority.mint = mint.key();
    mint_authority.authority = ctx.accounts.initializer.key();
    mint_authority.bump = ctx.bumps.mint_authority;

    // Initialize can_mint with a single element to reduce memory usage
    can_mint.mint = mint.key();
    can_mint.authorities = vec![ctx.accounts.initializer.key()];
    can_mint.mint_amounts = vec![0];
    can_mint.bump = ctx.bumps.can_mint;

    // Emit initialize event
    emit!(TokenInitializedEvent {
        mint: mint.key(),
        admin: ctx.accounts.initializer.key(),
        name: name.clone(),
        symbol: symbol.clone(),
        uri: uri.clone(),
        decimals
    });

    Ok(())
}

// Secondary initialization handler
pub fn initialize_secondary_handler(ctx: Context<InitializeSecondary>) -> Result<()> {
    let blacklist = &mut ctx.accounts.blacklist;
    let can_forward = &mut ctx.accounts.can_forward;
    let trusted_contracts = &mut ctx.accounts.trusted_contracts;

    // Initialize blacklist with pre-allocated capacity but empty content
    blacklist.mint = ctx.accounts.mint.key();
    blacklist.blacklist = Vec::new();
    blacklist.bump = ctx.bumps.blacklist;

    // Initialize can_forward with pre-allocated capacity but empty content
    can_forward.mint = ctx.accounts.mint.key();
    can_forward.forwarders = Vec::new();
    can_forward.bump = ctx.bumps.can_forward;

    // Initialize trusted_contracts with pre-allocated capacity but empty content
    trusted_contracts.mint = ctx.accounts.mint.key();
    trusted_contracts.contracts = Vec::new();
    trusted_contracts.bump = ctx.bumps.trusted_contracts;

    // Emit secondary initialization event
    emit!(SecondaryInitializedEvent {
        mint: ctx.accounts.mint.key(),
        initializer: ctx.accounts.initializer.key(),
    });

    Ok(())
}

// Third initialization handler
pub fn initialize_third_handler(ctx: Context<InitializeThird>) -> Result<()> {
    let external_whitelist = &mut ctx.accounts.external_whitelist;
    let internal_whitelist = &mut ctx.accounts.internal_whitelist;

    external_whitelist.mint = ctx.accounts.mint.key();
    external_whitelist.whitelist = Vec::new();
    external_whitelist.bump = ctx.bumps.external_whitelist;

    internal_whitelist.mint = ctx.accounts.mint.key();
    internal_whitelist.whitelist = Vec::new();
    internal_whitelist.bump = ctx.bumps.internal_whitelist;

    // Build the list of extra accounts using SEEDS (not static pubkeys)
    let account_metas = vec![
        // Account 1: TokenConfig (PDA)
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: TOKEN_CONFIG_SEED.to_vec(),
                },
                Seed::AccountKey { index: 1 }, // mint is at index 1
            ],
            false, // not signer
            false, // not writable (read-only for transfer_paused check)
        )?,
        // Account 2: Blacklist (PDA)
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: BLACK_LIST_SEED.to_vec(),
                },
                Seed::AccountKey { index: 1 }, // mint
            ],
            false,
            false,
        )?,
        // Account 3: Internal Whitelist (PDA)
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: INTERNAL_WHITELIST_SEED.to_vec(),
                },
                Seed::AccountKey { index: 1 },
            ],
            false,
            false,
        )?,
        // Account 4: External Whitelist (PDA)
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: EXTERNAL_WHITELIST_SEED.to_vec(),
                },
                Seed::AccountKey { index: 1 },
            ],
            false,
            false,
        )?,
        // Account 5: Can Forward (PDA)
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: CAN_FORWARD_SEED.to_vec(),
                },
                Seed::AccountKey { index: 1 },
            ],
            false,
            false,
        )?,
    ];

    // Initialize the ExtraAccountMetaList
    let extra_meta_account_info = ctx.accounts.extra_metas_account.to_account_info();
    let mut data = extra_meta_account_info.try_borrow_mut_data()?;

    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &account_metas)?;

    emit!(ThirdInitializedEvent {
        mint: ctx.accounts.mint.key(),
        initializer: ctx.accounts.initializer.key(),
    });

    Ok(())
}

pub fn get_meta_list_size() -> Result<usize> {
    // We have 5 extra accounts, so the size is 5
    Ok(ExtraAccountMetaList::size_of(5).unwrap())
}
