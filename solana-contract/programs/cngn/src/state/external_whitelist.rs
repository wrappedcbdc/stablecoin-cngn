

// state/external_whitelist.rs
use anchor_lang::prelude::*;
use crate::errors::ErrorCode;

#[account]
pub struct ExternalWhiteList {
    pub mint: Pubkey,
    pub whitelist: Vec<Pubkey>,
    pub bump: u8,
}

impl ExternalWhiteList {
    pub const MAX_EXTERNAL_WHITELISTED: usize = 100;
    
    pub fn is_whitelisted(&self, address: &Pubkey) -> bool {
        self.whitelist.contains(address)
    }
    
    pub fn add(&mut self, address: &Pubkey) -> Result<()> {
        if self.whitelist.len() >= Self::MAX_EXTERNAL_WHITELISTED {
            return Err(ErrorCode::TooManyWhitelisted.into());
        }
        
        if !self.is_whitelisted(address) {
            self.whitelist.push(*address);
        }
        
        Ok(())
    }
    
    pub fn remove(&mut self, address: &Pubkey) -> Result<()> {
        if let Some(index) = self.whitelist.iter().position(|x| x == address) {
            self.whitelist.remove(index);
        }
        
        Ok(())
    }
}

impl ExternalWhiteList {
    pub fn space(max_whitelisted: usize) -> usize {
        8 + // discriminator
        32 + // mint
        4 + (32 * max_whitelisted) + // vec length + whitelist
        1 // bump
    }
}