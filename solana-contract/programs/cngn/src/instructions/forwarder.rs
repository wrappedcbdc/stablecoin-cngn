//src/instructions/forwarder.rs

use crate::errors::ErrorCode;
use crate::events::*;
use crate::state::*;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked,
};
use anchor_spl::token::{burn, transfer, Burn, Mint, Token, TokenAccount, Transfer}; // Import the transfer module
#[derive(Accounts)]
pub struct Execute<'info> {
    pub forwarder: Signer<'info>,

    /// CHECK: Sender verification is done via ed25519 signature in the handler function
    #[account(mut)]
    pub sender: UncheckedAccount<'info>,

    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

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

    // UserNonce PDA account to track the sender's nonce
    #[account(
        mut,
        seeds = [b"user-nonce", sender.key().as_ref(), can_forward.key().as_ref()],
        bump = user_nonce.bump,
        // This allows the account to be initialized if it doesn't exist yet
        has_one = can_forward,
        has_one = sender @ ErrorCode::InvalidOwner,
    )]
    pub user_nonce: Account<'info, UserNonce>,

    #[account(
        seeds = [b"token-config", token_config.mint.as_ref()],
        constraint = !token_config.transfer_paused @ ErrorCode::TransfersPaused,
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        seeds = [b"internal-whitelist", from.mint.as_ref()],
        bump,
    )]
    pub internal_whitelist: Account<'info, InternalWhiteList>,

    #[account(
        seeds = [b"external-whitelist", from.mint.as_ref()],
        bump,
    )]
    pub external_whitelist: Account<'info, ExternalWhiteList>,

    /// CHECK: This is a PDA that is only used as a signer for the token transfer
    /// We don't need to initialize it as an account; we just need its address for signing
    #[account(
        seeds = [b"transfer-auth", from.key().as_ref()], 
        bump,
    )]
    pub transfer_auth: UncheckedAccount<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,

    /// CHECK: This is the instructions sysvar
    pub instruction_sysvar: AccountInfo<'info>,

    // System program is likely needed
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeUserNonce<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"can-forward", token_config.mint.as_ref()],
        bump,
    )]
    pub can_forward: Account<'info, CanForward>,

    #[account(
        init,
        payer = user,
        space = UserNonce::space(),
        seeds = [b"user-nonce", user.key().as_ref(), can_forward.key().as_ref()],
        bump,
    )]
    pub user_nonce: Account<'info, UserNonce>,

    #[account(
        seeds = [b"token-config", token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_user_nonce_handler(ctx: Context<InitializeUserNonce>) -> Result<()> {
    let user_nonce = &mut ctx.accounts.user_nonce;
    user_nonce.sender = ctx.accounts.user.key();
    user_nonce.can_forward = ctx.accounts.can_forward.key();
    user_nonce.nonce = 0;
    user_nonce.bump = ctx.bumps.user_nonce;

    Ok(())
}

pub fn verify_ed25519_instruction(
    ctx: Context<Execute>,
    expected_public_key: &[u8],
    message: &[u8],
    signature: &[u8],
    amount: u64,
) -> Result<String> {
    require!(
        ctx.accounts.from.mint == ctx.accounts.mint.key(),
        ErrorCode::MintMismatch
    );

    require!(
        !ctx.accounts.can_forward.is_executed,
        ErrorCode::ReentrancyDetected
    );
    ctx.accounts.can_forward.lock()?;

    require!(
        ctx.accounts
            .can_forward
            .is_trusted_forwarder(&ctx.accounts.forwarder.key()),
        ErrorCode::UnauthorizedForwarder
    );

    //get token balance of sender and verify they have enough before transfer
    let sender_balance = ctx.accounts.from.amount;
    if sender_balance < amount {
        return Err(ErrorCode::InsufficientFunds.into());
    }
    let sender = ctx.accounts.from.key();
    let recipient = ctx.accounts.to.owner; // Check if either sender or recipient is blacklisted
    if ctx.accounts.blacklist.is_blacklisted(&sender)
        || ctx.accounts.blacklist.is_blacklisted(&recipient)
    {
        return Err(ErrorCode::UserBlacklisted.into());
    }
    let instruction_sysvar = &mut ctx.accounts.instruction_sysvar;
    let current_index = load_current_index_checked(instruction_sysvar)?;
    if current_index == 0 {
        return Err(ErrorCode::MissingEd25519Instruction.into());
    }

    let ed25519_instruction =
        load_instruction_at_checked((current_index - 1) as usize, instruction_sysvar)?;

    // Verify that the previous instruction is from the Ed25519 program
    let ed25519_program_id = ed25519_program::id();
    if ed25519_instruction.program_id != ed25519_program_id {
        return Err(ErrorCode::InvalidEd25519Instruction.into());
    }

    // Verify the content of the Ed25519 instruction
    let instruction_data = ed25519_instruction.data;

    if instruction_data.len() < 2 {
        return Err(ErrorCode::InvalidEd25519Instruction.into());
    }

    let num_signatures = instruction_data[0];
    if num_signatures != 1 {
        return Err(ErrorCode::InvalidEd25519Instruction.into());
    }

    // Must have at least 16 bytes to contain Ed25519SignatureOffsets
    require!(
        instruction_data.len() >= 16,
        ErrorCode::InvalidEd25519Instruction
    );

    // Parse Ed25519SignatureOffsets (bytes 2..16)
    let offsets: Ed25519SignatureOffsets =
        Ed25519SignatureOffsets::try_from_slice(&instruction_data[2..16])
            .map_err(|_| ErrorCode::InvalidEd25519Instruction)?;

    // Validate offsets are in current instruction (u16::MAX)
    require!(
        offsets.signature_instruction_index == u16::MAX
            && offsets.public_key_instruction_index == u16::MAX
            && offsets.message_instruction_index == u16::MAX,
        ErrorCode::InvalidEd25519Instruction
    );

    let data_len = instruction_data.len();

    // Bounds check for signature
    require!(
        (offsets.signature_offset as usize + 64) <= data_len,
        ErrorCode::InvalidEd25519Instruction
    );

    // Bounds check for public key
    require!(
        (offsets.public_key_offset as usize + 32) <= data_len,
        ErrorCode::InvalidEd25519Instruction
    );

    // Bounds check for message
    require!(
        (offsets.message_data_offset as usize + offsets.message_data_size as usize) <= data_len,
        ErrorCode::InvalidEd25519Instruction
    );

    // Verify public key
    let pubkey_start = offsets.public_key_offset as usize;
    let pubkey_end = pubkey_start + 32;
    if &instruction_data[pubkey_start..pubkey_end] != expected_public_key {
        return Err(ErrorCode::InvalidPublicKey.into());
    }

    // Verify message
    let msg_start = offsets.message_data_offset as usize;
    let msg_end = msg_start + offsets.message_data_size as usize;
    if &instruction_data[msg_start..msg_end] != message {
        return Err(ErrorCode::InvalidMessage.into());
    }

    // Verify signature
    let sig_start = offsets.signature_offset as usize;
    let sig_end = sig_start + 64;
    if &instruction_data[sig_start..sig_end] != signature {
        return Err(ErrorCode::InvalidSignature.into());
    }

    // Convert message to string for processing
    let message_str = match std::str::from_utf8(message) {
        Ok(s) => s,
        Err(_) => return Err(ErrorCode::InvalidInstructionFormat.into()),
    };

    // Parse message to extract nonce
    // Expected format: "action:amount:nonce"
    let parts: Vec<&str> = message_str.split(':').collect();
    if parts.len() < 3 {
        return Err(ErrorCode::InvalidInstructionFormat.into());
    }

    // Parse nonce from message
    let nonce = match parts[2].parse::<u64>() {
        Ok(n) => n,
        Err(_) => return Err(ErrorCode::InvalidInstructionFormat.into()),
    };

    // Verify and update nonce to prevent replay attacks
    // Now using the separate UserNonce PDA account
    ctx.accounts.user_nonce.verify_and_update_nonce(nonce)?;

    let from_key = ctx.accounts.from.key();
    let seeds = &[
        b"transfer-auth",
        from_key.as_ref(),
        &[ctx.bumps.transfer_auth],
    ];
    let signer_seeds = &[&seeds[..]];

    let transfer_cpi_accounts = Transfer {
        from: ctx.accounts.from.to_account_info(),
        to: ctx.accounts.to.to_account_info(),
        authority: ctx.accounts.transfer_auth.to_account_info(), // Use the PDA
    };

    let transfer_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_cpi_accounts,
        signer_seeds,
    );

    // Special case: If sender is external whitelisted AND recipient is internal whitelisted
    // We burn the tokens from the sender's account before transferring
    if ctx.accounts.external_whitelist.is_whitelisted(&sender)
        && ctx.accounts.internal_whitelist.is_whitelisted(&recipient)
    {
        // 1. Burn the tokens from the sender's account (where we have authority)
        let burn_cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.from.to_account_info(),
            authority: ctx.accounts.transfer_auth.to_account_info(), // Use the PDA
        };

        let burn_cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            burn_cpi_accounts,
        );

        // Burn the tokens
        burn(burn_cpi_ctx, amount)?;

             // Emit bridge-specific event for indexer
        emit!(BridgeBurnEvent {
            from_account: ctx.accounts.from.key(),
            sender: sender,
            recipient: recipient,
            amount,
            timestamp: Clock::get()?.unix_timestamp,
            source_chain: "solana".to_string(),
       
        });

        msg!("Bridge burn completed: {} tokens burned for cross-chain transfer", amount);
    } else {
        // Standard transfer
        transfer(transfer_cpi_ctx, amount)?;

        // Emit standard transfer event
        emit!(TokensTransferredEvent {
            from: ctx.accounts.from.key(),
            to: ctx.accounts.to.key(),
            amount,
        });
    }

    ctx.accounts.can_forward.unlock(); // Unlock can_forward

    // Convert message to string and return it
    emit!(ForwardedEvent {
        message: message_str.to_string(),
        sender: ctx.accounts.sender.key(),
        recipient: ctx.accounts.to.owner,
        amount,
        forwarder: ctx.accounts.forwarder.key(),
    });

    Ok(message_str.to_string())
}

#[derive(AnchorSerialize, AnchorDeserialize)]
struct Ed25519SignatureOffsets {
    signature_offset: u16,
    signature_instruction_index: u16,
    public_key_offset: u16,
    public_key_instruction_index: u16,
    message_data_offset: u16,
    message_data_size: u16,
    message_instruction_index: u16,
}
