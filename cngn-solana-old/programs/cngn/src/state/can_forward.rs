use crate::errors::ErrorCode;
use anchor_lang::prelude::*;

#[account]
pub struct CanForward {
    pub mint: Pubkey,
    pub forwarders: Vec<Pubkey>,
    pub admin: Pubkey,
    pub bump: u8,
    pub is_executed: bool,
}

// Separate account to track nonces per user
#[account]
pub struct UserNonce {
    pub sender: Pubkey,      // User who bundles the message
    pub can_forward: Pubkey, // Parent CanForward account this belongs to
    pub nonce: u64,          // Latest nonce used by this user
    pub bump: u8,
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
        } else {
            return Err(ErrorCode::NotForwarder.into());
        }

        Ok(())
    }

    pub fn lock(&mut self) -> Result<()> {
        if self.is_executed {
            return Err(ErrorCode::ReentrancyDetected.into());
        }
        self.is_executed = true;
        Ok(())
    }
   pub fn unlock(&mut self) {
        self.is_executed = false;
    }
}

impl CanForward {
    pub fn space(max_forwarders: usize) -> usize {
        8 + // discriminator
        32 + // mint
        32 + // admin
        4 + (32 * max_forwarders) + // vec length + forwarders
        1 + // bump
        1 // is_executed
    }
}

impl UserNonce {
    pub fn space() -> usize {
        8 +  // discriminator 
        32 + // user
        32 + // can_forward
        8 +  // nonce
        1 // bump
    }

    pub fn verify_and_update_nonce(&mut self, nonce: u64) -> Result<()> {
        // Verify nonce is greater than stored nonce
        if nonce <= self.nonce {
            return Err(ErrorCode::InvalidNonce.into());
        }

        // Update nonce
        self.nonce = nonce;
        Ok(())
    }
}
