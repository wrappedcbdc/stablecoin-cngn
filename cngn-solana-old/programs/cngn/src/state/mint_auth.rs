// state/mint_auth.rs
use anchor_lang::prelude::*;

#[account]
pub struct MintAuthority {
    pub mint: Pubkey,              // The mint this authority controls
    pub authority: Pubkey,         // The authority that can mint tokens
    pub update_authority: Pubkey,  // Authority that can update the mint
    pub freeze_authority: Pubkey,  // Authority that can freeze token accounts
    pub bump: u8,                  // PDA bump
}

impl MintAuthority {
    pub const LEN: usize = 8 +    // discriminator
                           32 +   // mint pubkey
                           32 +   // authority pubkey
                           32 +   // update_authority pubkey
                           32 +   // freeze_authority pubkey
                           1;     // bump
}