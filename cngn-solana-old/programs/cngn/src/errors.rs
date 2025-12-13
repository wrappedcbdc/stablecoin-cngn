// errors.rs
use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
   
    
    #[msg("Token transfers are currently paused")]
    TransfersPaused,
    
    #[msg("Invalid authority")]
    InvalidAuthority,
    
    #[msg("Invalid admin")]
    InvalidAdmin,
    
    #[msg("Invalid owner")]
    InvalidOwner,
    
    #[msg("Mint mismatch")]
    MintMismatch,

    #[msg("User is not found in the list")]
    UserNotFound,
    
    
    #[msg("User is blacklisted")]
    UserBlacklisted,
    
    #[msg("User is already a minter")]
    AlreadyMinter,
    
    #[msg("User is not a minter")]
    NotMinter,

    
    #[msg("User is already a forwarder")]
    AlreadyForwarder,
    
    #[msg("User is not a forwarder")]
    NotForwarder,
    
    #[msg("Contract is already trusted")]
    AlreadyTrusted,
    
    #[msg("Contract is not trusted")]
    NotTrusted,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Too many authorities")]
    TooManyAuthorities,
    
    #[msg("Too many contracts")]
    TooManyContracts,
    
    #[msg("Too many blacklisted addresses")]
    TooManyBlacklisted,

    #[msg("Too many whitelisted addresses")]
    TooManyWhitelisted,

    #[msg("Data inconsistency between authorities and limits")]
    DataInconsistency,

    #[msg("Too many mint amount entries")]
    TooManyEntries,

    #[msg("Exceeds mint limit")]
    ExceedsMintLimit,

    #[msg("Cannot remove the program that is currently executing this instruction")]
    CannotRemoveSelf,

    #[msg("Insufficient funds for transfer")]
    InsufficientFunds,

    #[msg("Signer is blacklisted")]
    SignerBlacklisted,

    #[msg("Receiver is blacklisted")]
    ReceiverBlacklisted,

    #[msg("Minter not authorized to sign")]
    MinterNotAuthorized,

    #[msg("Attempting to mint more than allowed")]
    InvalidMintAmount,

    #[msg("Failed to revoke minting authorization")]
    FailedToRevokeMinting,

    #[msg("Minting is paused")]
    MintingPaused,

    #[msg("Already set to this state")]
    AlreadyPassedDesiredState,
    
    #[msg("Invalid signature")]
    InvalidSignature,
    
    #[msg("Payload account mismatch")]
    PayloadAccountMismatch,

    #[msg("Transaction already processed.")]
    AlreadyProcessed,
    
    #[msg("Invalid instruction format.")]
    InvalidInstructionFormat,
    
    #[msg("Forwarded instruction execution failed.")]
    ForwardedInstructionFailed,
    
    #[msg("Unauthorized forwarder.")]
    UnauthorizedForwarder,

    #[msg("Invalid message hash")]
    InvalidMessageHash,


    #[msg("Missing Ed25519 instruction")]
    MissingEd25519Instruction,
    
    #[msg("Invalid Ed25519 instruction format")]
    InvalidEd25519Instruction,
    
    #[msg("Invalid public key in Ed25519 instruction")]
    InvalidPublicKey,
    
    #[msg("Invalid message in Ed25519 instruction")]
    InvalidMessage,
    
    #[msg("Reentrancy detected")]
    ReentrancyDetected,

    #[msg("User is not blacklisted")]
    UserNotBlacklisted,

     #[msg("Invalid nonce: possible replay attack")]
    InvalidNonce,
}