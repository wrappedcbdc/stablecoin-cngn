//src/instructions/forwarder.rs
use crate::errors::ErrorCode;
use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked,
};
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(mut)]
    pub forwarder: Signer<'info>,

    /// CHECK:
    #[account(mut)]
    pub sender: AccountInfo<'info>,

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

    #[account(
        seeds = [b"token-config", token_config.mint.as_ref()],
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

    /// CHECK:
    #[account(
        mut,
        seeds = [b"transfer-auth", from.key().as_ref()], 
        bump,
    )]
    pub transfer_auth: AccountInfo<'info>, // PDA acts as an intermediary

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,

    /// CHECK: This is the instructions sysvar
    pub instruction_sysvar: AccountInfo<'info>,

    // System program is likely needed
    pub system_program: Program<'info, System>,
}

pub fn verify_ed25519_instruction(
    ctx: Context<Execute>,
    expected_public_key: &[u8],
    message: &[u8],
    signature: &[u8],
    amount: u64,
) -> Result<String> {
    
    require!(
        !ctx.accounts.can_forward.is_executed,
        ErrorCode::ReentrancyDetected
    );
    ctx.accounts.can_forward.is_executed = true;

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
    let instruction_sysvar = &mut ctx.accounts.instruction_sysvar;
    let current_index = load_current_index_checked(instruction_sysvar)?;
    if current_index == 0 {
        return Err(ErrorCode::MissingEd25519Instruction.into());
    }

    let ed25519_instruction =
        load_instruction_at_checked((current_index - 1) as usize, instruction_sysvar)?;

    // Verify the content of the Ed25519 instruction
    let instruction_data = ed25519_instruction.data;
    if instruction_data.len() < 2 {
        return Err(ErrorCode::InvalidEd25519Instruction.into());
    }

    let num_signatures = instruction_data[0];
    if num_signatures != 1 {
        return Err(ErrorCode::InvalidEd25519Instruction.into());
    }

    // Parse Ed25519SignatureOffsets
    let offsets: Ed25519SignatureOffsets =
        Ed25519SignatureOffsets::try_from_slice(&instruction_data[2..16])?;

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

    token::transfer(transfer_cpi_ctx, amount)?;

    // Emit standard transfer event
    emit!(TokensTransferredEvent {
        from: ctx.accounts.from.key(),
        to: ctx.accounts.to.key(),
        amount,
    });
    ctx.accounts.can_forward.is_executed = false;
    // Convert message to string and return it
    match std::str::from_utf8(message) {
        Ok(message_str) => {
            emit!(ForwardedEvent {
                message: message_str.to_string(),
            });
            Ok(message_str.to_string())
        }
        Err(_) => Err(ErrorCode::InvalidInstructionFormat.into()),
    }
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
