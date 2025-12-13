// // src/instructions/transfer_hook.rs
// use std::cell::RefMut;
// use crate::errors::ErrorCode;
// use crate::events::*;
// use crate::state::*;
// use anchor_lang::prelude::*;

// use anchor_spl::{
//     token_2022::spl_token_2022::{
//         extension::{
//             transfer_hook::TransferHookAccount, BaseStateWithExtensionsMut,
//             PodStateWithExtensionsMut,
//         },
//         pod::PodAccount,
//     },
//     token_interface::{Mint, TokenAccount},
// };

// // NOTE: This must match the exact order in initialize_third_handler!
// #[derive(Accounts)]
// pub struct TransferHook<'info> {
//     // The required accounts for the Token Program to call the hook
//     /// CHECK: source token account
//     pub source_token: InterfaceAccount<'info, TokenAccount>,
//     /// CHECK: mint account
//     #[account(address = source_token.mint @ ErrorCode::InvalidMint)] // Basic check
//     pub mint: InterfaceAccount<'info, Mint>,
//     /// CHECK: destination token account
//     pub destination_token: InterfaceAccount<'info, TokenAccount>,
//     /// CHECK: owner of the source token account (signer/delegate)
//     pub owner: AccountInfo<'info>,

//     /// CHECK: extra account meta list
//     #[account(
//         seeds = [META_LIST_ACCOUNT_SEED, mint.key().as_ref()],
//         bump,
//     )]
//     pub extra_account_meta_list: UncheckedAccount<'info>,

//     // --- Extra Accounts (Match Order of ExtraAccountMetaList) ---
//     // These must be supplied by the client in remainingAccounts
//     pub token_config: Account<'info, TokenConfig>,
//     pub blacklist: Account<'info, BlackList>,
//     pub internal_whitelist: Account<'info, InternalWhiteList>,
//     pub external_whitelist: Account<'info, ExternalWhiteList>,
//     pub can_forward: Account<'info, CanForward>,
// }

// pub fn transfer_hook_handler(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
//     check_is_transferring(&ctx)?;
//     let source = &ctx.accounts.source_token;
//     let owner = &ctx.accounts.owner; // The signer/delegate
//     let destination = &ctx.accounts.destination_token;

//     let token_config = &ctx.accounts.token_config;
//     let blacklist = &ctx.accounts.blacklist;
//     let internal_whitelist = &ctx.accounts.internal_whitelist;
//     let external_whitelist = &ctx.accounts.external_whitelist;

//     // --- 1. Basic Security Checks (Pause/Blacklist) ---
//     if token_config.transfer_paused {
//         return Err(ErrorCode::TransfersPaused.into());
//     }

//     // Check if source token account owner is blacklisted
//     if blacklist.is_blacklisted(&source.owner) {
//         return Err(ErrorCode::UserBlacklisted.into());
//     }
//     // Check if recipient token account owner is blacklisted
//     if blacklist.is_blacklisted(&destination.owner) {
//         return Err(ErrorCode::UserBlacklisted.into());
//     }

//     // --- 2. Redemption Flow Detection ---
//     let is_redemption_transfer = external_whitelist.is_whitelisted(&source.owner)
//         && internal_whitelist.is_whitelisted(&destination.owner);
//     if is_redemption_transfer {
//         // If it's the specific redemption flow:
//         // 1. Emit the event for the off-chain system to pick up.
//         // 2. Allow the transfer to proceed (return Ok(())).
//         emit!(RedemptionEvent {
//             from: source.key(),
//             owner: owner.key(), // The signer who initiated the transfer
//             to: destination.key(),
//             amount,
//             timestamp: Clock::get()?.unix_timestamp,
//         });

//         return Ok(()); // APPROVED: Transfer completes, tokens move to Admin's account.
//     }

//     // --- 3. Standard Transfer Checks ---

//     // Check if the signer (owner) is authorized to move tokens from the source_token account.
//     // This handles transfers signed by the token owner or an approved delegate.
//     if source.owner != owner.key() {
//         // We only need to check if the signer is a trusted forwarder if they are NOT the owner.
//         let can_forward = &ctx.accounts.can_forward;

//         // Check if the signer (delegate) is in the Trusted Forwarder Whitelist
//         if !can_forward.is_trusted_forwarder(&owner.key()) {
//             return Err(ErrorCode::UnauthorizedForwarder.into());
//         }
//     }

//     // If the transfer is not a special redemption flow and passes all standard checks.
//     Ok(()) // APPROVED: Standard transfer completes.
// }

// fn check_is_transferring(ctx: &Context<TransferHook>) -> Result<()> {
//     let source_token_info = ctx.accounts.source_token.to_account_info();
//     let mut account_data_ref: RefMut<&mut [u8]> = source_token_info.try_borrow_mut_data()?;
//     let mut account = PodStateWithExtensionsMut::<PodAccount>::unpack(*account_data_ref)?;
//     let account_extension = account.get_extension_mut::<TransferHookAccount>()?;

//     if !bool::from(account_extension.transferring) {
//         return err!(ErrorCode::IsNotCurrentlyTransferring);
//     }

//     Ok(())
// }
