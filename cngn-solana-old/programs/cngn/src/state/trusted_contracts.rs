// state/trustcontract.rs
use anchor_lang::prelude::*;
use crate::errors::ErrorCode;

#[account]
pub struct TrustedContracts {
    pub mint: Pubkey,
    pub contracts: Vec<Pubkey>,
    pub bump: u8,
}

impl TrustedContracts {
    pub const MAX_CONTRACTS: usize = 50;
    
    pub fn is_trusted_contract(&self, contract: &Pubkey) -> bool {
        self.contracts.contains(contract)
    }
    
    pub fn add(&mut self, contract: &Pubkey) -> Result<()> {
        if self.contracts.len() >= Self::MAX_CONTRACTS {
            return Err(ErrorCode::TooManyContracts.into());
        }
        
        if !self.is_trusted_contract(contract) {
            self.contracts.push(*contract);
        }
        
        Ok(())
    }
    
    pub fn remove(&mut self, contract: &Pubkey) -> Result<()> {
        if let Some(index) = self.contracts.iter().position(|x| x == contract) {
            self.contracts.remove(index);
        }
        
        Ok(())
    }
}

impl TrustedContracts {
    pub fn space(max_contracts: usize) -> usize {
        8 + // discriminator
        32 + // mint
        4 + (32 * max_contracts) + // vec length + contracts
        1 // bump
    }
}