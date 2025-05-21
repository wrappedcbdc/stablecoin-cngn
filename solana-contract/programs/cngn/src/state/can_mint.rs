//state/can_mint.rs
use anchor_lang::prelude::*;
use crate::errors::ErrorCode;

#[account]
pub struct CanMint {
    pub mint: Pubkey,
    pub authorities: Vec<Pubkey>,
    pub mint_amounts: Vec<u64>,
    pub bump: u8,
}

impl CanMint {
    pub const MAX_AUTHORITIES: usize = 100;

    pub fn can_mint(&self, authority: &Pubkey) -> bool {
        self.authorities.contains(authority)
    }

    pub fn add_authority(&mut self, authority: &Pubkey) -> Result<()> {
        if self.authorities.len() >= Self::MAX_AUTHORITIES {
            return Err(ErrorCode::TooManyAuthorities.into());
        }

        if !self.can_mint(authority) {
            self.authorities.push(*authority);
            self.mint_amounts.push(0); // Initialize mint amount to 0
        }

        Ok(())
    }

    pub fn remove_authority(&mut self, authority: &Pubkey) -> Result<()> {
        if let Some(index) = self.authorities.iter().position(|x| x == authority) {
            self.authorities.remove(index);
            self.mint_amounts.remove(index); // Remove corresponding mint amount
            Ok(())
        } else {
            Err(ErrorCode::NotMinter.into())
        }
    }

    pub fn set_mint_amount(&mut self, authority: &Pubkey, amount: u64) -> Result<()> {
        
        if let Some(index) = self.authorities.iter().position(|x| x == authority) {
            self.mint_amounts[index] = amount;
            Ok(())
        } else {
            Err(ErrorCode::NotMinter.into())
        }
    }



    pub fn get_mint_amount(&self, authority: &Pubkey) -> Result<u64> {
        if let Some(index) = self.authorities.iter().position(|x| x == authority) {
            Ok(self.mint_amounts[index])
        } else {
            Err(ErrorCode::NotMinter.into())
        }
    }

    pub fn space(max_authorities: usize) -> usize {
        8 + // discriminator
        32 + // mint
        4 + (32 * max_authorities) + // vec length + authorities
        4 + (8 * max_authorities) + // vec length + mint amounts
        1 // bump
    }
}
