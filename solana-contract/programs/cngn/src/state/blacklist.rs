// state/blacklist.rs
use anchor_lang::prelude::*;
use crate::errors::ErrorCode;

#[account]
pub struct BlackList {
    pub mint: Pubkey,
    pub blacklist: Vec<Pubkey>,
    pub bump: u8,
}

impl BlackList {
    pub const MAX_BLACKLISTED: usize = 100;
    
    pub fn is_blacklisted(&self, address: &Pubkey) -> bool {
        self.blacklist.contains(address)
    }
    
    pub fn add(&mut self, address: &Pubkey) -> Result<()> {
        if self.blacklist.len() >= Self::MAX_BLACKLISTED {
            return Err(ErrorCode::TooManyBlacklisted.into());
        }
        
        if !self.is_blacklisted(address) {
            self.blacklist.push(*address);
        }
        
        Ok(())
    }
    
  // In blacklist.rs
pub fn remove(&mut self, address: &Pubkey) -> Result<()> {
    if let Some(index) = self.blacklist.iter().position(|x| x == address) {
        self.blacklist.remove(index);
        Ok(())
    } else {
        // Add this error to your ErrorCode enum
        Err(ErrorCode::UserNotBlacklisted.into())
    }
}
}

impl BlackList {
    pub fn space(max_blacklisted: usize) -> usize {
        8 + // discriminator
        32 + // mint
        4 + (32 * max_blacklisted) + // vec length + blacklist
        1 // bump
    }
}