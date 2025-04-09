
// state/token_config.rs
use anchor_lang::prelude::*;

pub const MIN_MINT_AMOUNT: u64 = 1; // Minimum mint amount
pub const MAX_MINT_AMOUNT: u64 = 1_000_000_000; // Maximum mint amount


#[account]
pub struct TokenConfig {
    pub name: String,           // Token name
    pub symbol: String,         // Token symbol
    pub decimals: u8,           // Token decimals
    pub mint: Pubkey,           // Token mint address
    pub admin: Pubkey,          // Admin authority
    pub mint_paused: bool,      // Flag to track if minting is paused
    pub transfer_paused: bool,  // Flag to track if transfers are paused
    pub bump: u8,               // PDA bump
}


// state/token_config.rs
impl TokenConfig {
    pub const MAX_NAME_LENGTH: usize = 32;
    pub const MAX_SYMBOL_LENGTH: usize = 10;

    
    pub const MIN_MINT_AMOUNT: u64 = MIN_MINT_AMOUNT;
    pub const MAX_MINT_AMOUNT: u64 = MAX_MINT_AMOUNT;

    
    pub const LEN: usize = 8 +  // discriminator
        4 + Self::MAX_NAME_LENGTH +    // name (4-byte len + content)
        4 + Self::MAX_SYMBOL_LENGTH +  // symbol (4-byte len + content)
        1 +  // decimals
        32 + // mint
        32 + // admin
        1 +  // mint_paused
        1 +  // transfer_paused
        1;   // bump
}