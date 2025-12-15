// state/token_config.rs
use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use anchor_lang::prelude::sysvar::instructions::*;
pub const META_LIST_ACCOUNT_SEED: &[u8] = b"extra-account-metas";
pub const TOKEN_CONFIG_SEED: &[u8] = b"token-config";
pub const SPL_GOVERNANCE_PROGRAM_ID: Pubkey =
    solana_program::pubkey!("GovernoR1LQdaQKK7Kpz9QYCwvBtVpXQXbXHX2d5vNpL");

#[account]
pub struct TokenConfig {
    pub name: String,          // Token name
    pub symbol: String,        // Token symbol
    pub decimals: u8,          // Token decimals
    pub mint: Pubkey,          // Token mint address
    pub admin: Pubkey,         // Admin authority
    pub mint_paused: bool,     // Flag to track if minting is paused
    pub transfer_paused: bool, // Flag to track if transfers are paused
    pub bump: u8,              // PDA bump
}

// state/token_config.rs
impl TokenConfig {
    pub const MAX_NAME_LENGTH: usize = 32;
    pub const MAX_SYMBOL_LENGTH: usize = 10;

    pub const MIN_MINT_AMOUNT: u64 = 1;
    pub const MAX_MINT_AMOUNT: u64 = 1_000_000_000;

    pub const LEN: usize = 8 +  // discriminator
        4 + Self::MAX_NAME_LENGTH +    // name (4-byte len + content)
        4 + Self::MAX_SYMBOL_LENGTH +  // symbol (4-byte len + content)
        1 +  // decimals
        32 + // mint
        32 + // admin
        1 +  // mint_paused
        1 +  // transfer_paused
        1; // bump

    pub fn validate_caller<'info>(
        &self,
        authority: &UncheckedAccount<'info>,
        instructions_sysvar: &AccountInfo<'info>,
    ) -> Result<()> {
        // Admin must match
        require_keys_eq!(authority.key(), self.admin, ErrorCode::Unauthorized);

        // EOA path - direct signing
        if authority.is_signer {
            return Ok(());
        }

        // CPI path - must be from governance
        let current_index = load_current_index_checked(instructions_sysvar)?;
        require!(current_index > 0, ErrorCode::NotCpi);

        // Get parent instruction
        let parent_ix =
            load_instruction_at_checked(current_index as usize - 1, instructions_sysvar)?;

        // Must be called by SPL Governance
        require!(
            parent_ix.program_id == SPL_GOVERNANCE_PROGRAM_ID,
            ErrorCode::InvalidGovernanceProgram
        );

        // Authority must be owned by Governance program
        // (This ensures it's a real governance PDA, not a fake account)
        require_keys_eq!(
            *authority.owner,
            SPL_GOVERNANCE_PROGRAM_ID,
            ErrorCode::InvalidGovernanceProgram
        );

        Ok(())
    }
}
