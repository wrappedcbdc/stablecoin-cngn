// src/state/multisig.rs
use crate::errors::ErrorCode;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked;
use sha2::{Digest, Sha256};
use solana_program::ed25519_program;
use std::collections::BTreeSet;

#[account]
pub struct Multisig {
    pub owners: Vec<Pubkey>,
    pub threshold: u8,
    pub nonce: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
struct Ed25519SignatureOffsets {
    signature_offset: u16,
    signature_instruction_index: u16,
    public_key_offset: u16,
    public_key_instruction_index: u16,
    message_data_offset: u16,
    message_data_size: u16,
    message_instruction_index: u16,
}

impl Multisig {
    pub const MULTISIG_SEED: &'static [u8] = b"multisig";
    pub const MAX_OWNERS: usize = 10;

    pub fn space(max_owners: usize) -> usize {
        8 +                         // discriminator
        4 + (32 * max_owners) +     // owners vec
        1 +                         // threshold
        8 +                         // nonce
        1 // bump
    }

    pub fn is_owner(&self, key: &Pubkey) -> bool {
        self.owners.contains(key)
    }

    pub fn assert_valid_threshold(owners_len: usize, threshold: u8) -> Result<()> {
        require!(threshold > 0, ErrorCode::InvalidThreshold);
        require!(
            threshold as usize <= owners_len,
            ErrorCode::InvalidThreshold
        );
        Ok(())
    }

    pub fn rotate_owners(&mut self, new_owners: Vec<Pubkey>, new_threshold: u8) -> Result<()> {
        require!(
            new_owners.len() <= Self::MAX_OWNERS,
            ErrorCode::TooManyOwners
        );

        Self::assert_valid_threshold(new_owners.len(), new_threshold)?;

        self.owners = new_owners;
        self.threshold = new_threshold;

        Ok(())
    }
}

// ============================================================================
// Standalone helper functions (NOT methods on Multisig)
// ============================================================================

/// Parse an Ed25519 instruction and extract the signer pubkey and message
fn parse_ed25519_ix(ix: &solana_program::instruction::Instruction) -> Result<(Pubkey, Vec<u8>)> {
    let data = &ix.data;

    // Verify minimum length
    require!(data.len() >= 16, ErrorCode::InvalidEd25519Instruction);

    // Check number of signatures
    let num_signatures = data[0];
    require!(num_signatures == 1, ErrorCode::InvalidEd25519Instruction);

    // Parse offsets structure (bytes 2..16)
    let offsets = Ed25519SignatureOffsets::try_from_slice(&data[2..16])
        .map_err(|_| ErrorCode::InvalidEd25519Instruction)?;

    // Validate that all data is in the current instruction
    require!(
        offsets.signature_instruction_index == u16::MAX
            && offsets.public_key_instruction_index == u16::MAX
            && offsets.message_instruction_index == u16::MAX,
        ErrorCode::InvalidEd25519Instruction
    );

    let data_len = data.len();

    // Bounds checks
    require!(
        (offsets.signature_offset as usize + 64) <= data_len,
        ErrorCode::InvalidEd25519Instruction
    );
    require!(
        (offsets.public_key_offset as usize + 32) <= data_len,
        ErrorCode::InvalidEd25519Instruction
    );
    require!(
        (offsets.message_data_offset as usize + offsets.message_data_size as usize) <= data_len,
        ErrorCode::InvalidEd25519Instruction
    );

    // Extract public key (32 bytes)
    let pubkey_start = offsets.public_key_offset as usize;
    let pubkey_bytes = &data[pubkey_start..pubkey_start + 32];
    let signer = Pubkey::new_from_array(
        pubkey_bytes
            .try_into()
            .map_err(|_| ErrorCode::InvalidPublicKey)?,
    );

    // Extract message
    let msg_start = offsets.message_data_offset as usize;
    let msg_end = msg_start + offsets.message_data_size as usize;
    let message = data[msg_start..msg_end].to_vec();

    Ok((signer, message))
}

/// Validate that enough multisig owners have signed the expected message
pub fn validate_multisig_authorization(
    multisig: &mut Multisig,
    instructions: &AccountInfo,
    expected_message: &[u8],
) -> Result<()> {
    const MAX_INSTRUCTIONS_TO_CHECK: usize = 20;

    let mut approvals = 0u8;
    let mut seen = BTreeSet::<Pubkey>::new();

    let mut idx = 0;
    while idx < MAX_INSTRUCTIONS_TO_CHECK {
        let ix = match load_instruction_at_checked(idx, instructions) {
            Ok(ix) => ix,
            Err(_) => break, // No more instructions
        };
        idx += 1;

        // Skip non-Ed25519 instructions
        if ix.program_id != ed25519_program::ID {
            continue;
        }

        // Parse the Ed25519 instruction to extract signer and message
        let (signer, message) = parse_ed25519_ix(&ix)?;

        // Check if message matches what we expect
        if message != expected_message {
            continue;
        }

        // Check if signer is a valid owner
        if !multisig.is_owner(&signer) {
            continue;
        }

        // Count unique approvals (deduplicate)
        if seen.insert(signer) {
            approvals += 1;

            // Early exit if we've reached threshold
            if approvals >= multisig.threshold {
                break;
            }
        }
    }

    // Verify we have enough approvals
    require!(
        approvals >= multisig.threshold,
        ErrorCode::NotEnoughMultisigSigners
    );
    // This prevents replay attacks
    multisig.nonce += 1;

    Ok(())
}

/// Build message for updating multisig configuration
pub fn build_update_multisig_message(
    multisig: &Pubkey,
    new_owners: &[Pubkey],
    new_threshold: u8,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"UPDATE_MULTISIG");
    hasher.update(multisig.as_ref());

    for owner in new_owners {
        hasher.update(owner.as_ref());
    }

    hasher.update(&[new_threshold]);
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

/// Build message for adding a can_mint authority
pub fn build_add_can_mint_message(can_mint_account: &Pubkey, user: &Pubkey, nonce: u64) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"ADD_CAN_MINT");
    hasher.update(can_mint_account.as_ref());
    hasher.update(user.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

/// Build message for removing a can_mint authority
pub fn build_remove_can_mint_message(
    can_mint_account: &Pubkey,
    user: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"REMOVE_CAN_MINT");
    hasher.update(can_mint_account.as_ref());
    hasher.update(user.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

pub fn build_set_mint_amount_message(
    can_mint_account: &Pubkey,
    user: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"SET_MINT_AMOUNT");
    hasher.update(can_mint_account.as_ref());
    hasher.update(user.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

pub fn build_remove_mint_amount_message(
    can_mint_account: &Pubkey,
    user: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"REMOVE_MINT_AMOUNT");
    hasher.update(can_mint_account.as_ref());
    hasher.update(user.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}
/// Build message for adding a can_forward authority
pub fn build_add_can_forward_message(
    can_forward_account: &Pubkey,
    forwarder: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"ADD_CAN_FORWARD");
    hasher.update(can_forward_account.as_ref());
    hasher.update(forwarder.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

/// Build message for removing a can_forward authority
pub fn build_remove_can_forward_message(
    can_forward_account: &Pubkey,
    forwarder: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"REMOVE_CAN_FORWARD");
    hasher.update(can_forward_account.as_ref());
    hasher.update(forwarder.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

/// Build message for adding to blacklist
pub fn build_add_blacklist_message(
    blacklist_account: &Pubkey,
    user: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"ADD_BLACKLIST");
    hasher.update(blacklist_account.as_ref());
    hasher.update(user.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

/// Build message for removing from blacklist
pub fn build_remove_blacklist_message(
    blacklist_account: &Pubkey,
    user: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"REMOVE_BLACKLIST");
    hasher.update(blacklist_account.as_ref());
    hasher.update(user.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

/// Build message for adding trusted contract
pub fn build_add_trusted_contract_message(
    trusted_contracts_account: &Pubkey,
    contract: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"ADD_TRUSTED_CONTRACT");
    hasher.update(trusted_contracts_account.as_ref());
    hasher.update(contract.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

/// Build message for removing trusted contract
pub fn build_remove_trusted_contract_message(
    trusted_contracts_account: &Pubkey,
    contract: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"REMOVE_TRUSTED_CONTRACT");
    hasher.update(trusted_contracts_account.as_ref());
    hasher.update(contract.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

/// Build message for whitelisting internal user
pub fn build_whitelist_internal_message(
    internal_whitelist_account: &Pubkey,
    user: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"WHITELIST_INTERNAL");
    hasher.update(internal_whitelist_account.as_ref());
    hasher.update(user.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

/// Build message for whitelisting external user
pub fn build_whitelist_external_message(
    external_whitelist_account: &Pubkey,
    user: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"WHITELIST_EXTERNAL");
    hasher.update(external_whitelist_account.as_ref());
    hasher.update(user.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

/// Build message for blacklisting internal user (removing from internal whitelist)
pub fn build_blacklist_internal_message(
    internal_whitelist_account: &Pubkey,
    user: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"BLACKLIST_INTERNAL");
    hasher.update(internal_whitelist_account.as_ref());
    hasher.update(user.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

/// Build message for blacklisting external user (removing from external whitelist)
pub fn build_blacklist_external_message(
    external_whitelist_account: &Pubkey,
    user: &Pubkey,
    nonce: u64,
) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"BLACKLIST_EXTERNAL");
    hasher.update(external_whitelist_account.as_ref());
    hasher.update(user.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

pub fn build_pause_mint_message(token_config_account: &Pubkey, nonce: u64) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"PAUSE_MINTING");
    hasher.update(token_config_account.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}

pub fn build_pause_transfer_message(token_config_account: &Pubkey, nonce: u64) -> Vec<u8> {
    let mut hasher = Sha256::new();

    hasher.update(b"PAUSE_TRANSFER");
    hasher.update(token_config_account.as_ref());
    hasher.update(&nonce.to_le_bytes());

    hasher.finalize().to_vec()
}
