use anchor_lang::prelude::*;
use crate::errors::ErrorCode;

#[account]
pub struct CanForward {
    pub mint: Pubkey,
    pub forwarders: Vec<Pubkey>,
    pub admin: Pubkey,
    pub bump: u8,
}

#[account]
pub struct UserNonce {
    pub user: Pubkey,
    pub nonce: u64,
}

impl CanForward {
    pub const MAX_FORWARDERS: usize = 100;

    pub fn is_trusted_forwarder(&self, forwarder: &Pubkey) -> bool {
        self.forwarders.contains(forwarder)
    }

    pub fn contains(&self, forwarder: &Pubkey) -> bool {
        self.forwarders.contains(forwarder)
    }

    pub fn add(&mut self, forwarder: &Pubkey) -> Result<()> {
        if self.forwarders.len() >= Self::MAX_FORWARDERS {
            return Err(ErrorCode::TooManyContracts.into());
        }

        if !self.contains(forwarder) {
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

impl UserNonce {
    pub fn verify_and_update_nonce(&mut self, nonce: u64) -> Result<()> {
        // Ensure nonce is strictly increasing to prevent replay attacks
        if nonce <= self.nonce {
            return Err(ErrorCode::InvalidNonce.into());
        }

        // Update the nonce
        self.nonce = nonce;
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

impl UserNonce {
    pub fn space() -> usize {
        8 + // discriminator
        32 + // user
        8   // nonce
    }
}
