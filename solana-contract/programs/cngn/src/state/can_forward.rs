use anchor_lang::prelude::*;
use crate::errors::ErrorCode;

#[account]
pub struct CanForward {
    pub mint: Pubkey,
    pub forwarders: Vec<Pubkey>,
    pub admin: Pubkey,
    pub bump: u8,
    pub is_executed: bool, 
}


impl CanForward {
    pub const MAX_FORWARDERS: usize = 100;

    pub fn is_trusted_forwarder(&self, forwarder: &Pubkey) -> bool {
        self.forwarders.contains(forwarder)
    }


    pub fn add(&mut self, forwarder: &Pubkey) -> Result<()> {
        if self.forwarders.len() >= Self::MAX_FORWARDERS {
            return Err(ErrorCode::TooManyContracts.into());
        }

        if !self.is_trusted_forwarder(forwarder) {
            self.forwarders.push(*forwarder);
        }

        Ok(())
    }

    pub fn remove(&mut self, forwarder: &Pubkey) -> Result<()> {
        if let Some(index) = self.forwarders.iter().position(|x| x == forwarder) {
            self.forwarders.remove(index);
        }

        Ok(())
    }
}



impl CanForward {
    pub fn space(max_forwarders: usize) -> usize {
        8 + // discriminator
        32 + // mint
        4 + (32 * max_forwarders) + // vec length + forwarders
        1 // bump
    }
}

