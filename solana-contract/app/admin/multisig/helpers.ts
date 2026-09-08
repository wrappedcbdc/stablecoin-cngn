// helpers.ts
import { PublicKey, Keypair, TransactionInstruction } from "@solana/web3.js";
import { createHash } from "crypto";
import nacl from "tweetnacl";

// ============================================================================
// Message Building Functions (MUST match Rust exactly!)
// ============================================================================

/**
 * Build SHA256 hash message for adding a can_mint authority
 */
export function buildAddCanMintMessage(
    canMintAccount: PublicKey,
    user: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("ADD_CAN_MINT");
    hash.update(canMintAccount.toBuffer());
    hash.update(user.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

export function buildSetMintAmountMessage(
    canMintAccount: PublicKey,
    user: PublicKey,
    nonce: number
): Buffer {
     const hash = createHash("sha256");
    hash.update("SET_MINT_AMOUNT");
    hash.update(canMintAccount.toBuffer());
    hash.update(user.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}
/**
 * Build SHA256 hash message for removing a can_mint authority
 */
export function buildRemoveCanMintMessage(
    canMintAccount: PublicKey,
    user: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("REMOVE_CAN_MINT");
    hash.update(canMintAccount.toBuffer());
    hash.update(user.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

/**
 * Build SHA256 hash message for adding a can_forward authority
 */
export function buildAddCanForwardMessage(
    canForwardAccount: PublicKey,
    forwarder: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("ADD_CAN_FORWARD");
    hash.update(canForwardAccount.toBuffer());
    hash.update(forwarder.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

/**
 * Build SHA256 hash message for removing a can_forward authority
 */
export function buildRemoveCanForwardMessage(
    canForwardAccount: PublicKey,
    forwarder: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("REMOVE_CAN_FORWARD");
    hash.update(canForwardAccount.toBuffer());
    hash.update(forwarder.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

/**
 * Build SHA256 hash message for adding to blacklist
 */
export function buildAddBlacklistMessage(
    blacklistAccount: PublicKey,
    user: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("ADD_BLACKLIST");
    hash.update(blacklistAccount.toBuffer());
    hash.update(user.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

/**
 * Build SHA256 hash message for removing from blacklist
 */
export function buildRemoveBlacklistMessage(
    blacklistAccount: PublicKey,
    user: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("REMOVE_BLACKLIST");
    hash.update(blacklistAccount.toBuffer());
    hash.update(user.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

/**
 * Build SHA256 hash message for updating multisig configuration
 */
export function buildUpdateMultisigMessage(
    multisig: PublicKey,
    newOwners: PublicKey[],
    newThreshold: number,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("UPDATE_MULTISIG_V1");
    hash.update(multisig.toBuffer());

    for (const owner of newOwners) {
        hash.update(owner.toBuffer());
    }

    hash.update(Buffer.from([newThreshold]));

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

/**
 * Build SHA256 hash message for adding trusted contract
 */
export function buildAddTrustedContractMessage(
    trustedContractsAccount: PublicKey,
    contract: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("ADD_TRUSTED_CONTRACT");
    hash.update(trustedContractsAccount.toBuffer());
    hash.update(contract.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

/**
 * Build SHA256 hash message for removing trusted contract
 */
export function buildRemoveTrustedContractMessage(
    trustedContractsAccount: PublicKey,
    contract: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("REMOVE_TRUSTED_CONTRACT");
    hash.update(trustedContractsAccount.toBuffer());
    hash.update(contract.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

/**
 * Build SHA256 hash message for whitelisting internal user
 */
export function buildWhitelistInternalMessage(
    internalWhitelistAccount: PublicKey,
    user: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("WHITELIST_INTERNAL");
    hash.update(internalWhitelistAccount.toBuffer());
    hash.update(user.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

/**
 * Build SHA256 hash message for whitelisting external user
 */
export function buildWhitelistExternalMessage(
    externalWhitelistAccount: PublicKey,
    user: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("WHITELIST_EXTERNAL");
    hash.update(externalWhitelistAccount.toBuffer());
    hash.update(user.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

/**
 * Build SHA256 hash message for blacklisting internal user
 */
export function buildBlacklistInternalMessage(
    internalWhitelistAccount: PublicKey,
    user: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("BLACKLIST_INTERNAL");
    hash.update(internalWhitelistAccount.toBuffer());
    hash.update(user.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

/**
 * Build SHA256 hash message for blacklisting external user
 */
export function buildBlacklistExternalMessage(
    externalWhitelistAccount: PublicKey,
    user: PublicKey,
    nonce: number
): Buffer {
    const hash = createHash("sha256");
    hash.update("BLACKLIST_EXTERNAL");
    hash.update(externalWhitelistAccount.toBuffer());
    hash.update(user.toBuffer());

    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    hash.update(nonceBuffer);

    return hash.digest();
}

// ============================================================================
// Ed25519 Instruction Creation
// ============================================================================

/**
 * Create Ed25519 signature verification instruction
 */
export function createEd25519Instruction(
    publicKey: Uint8Array,
    message: Uint8Array,
    signature: Uint8Array
): TransactionInstruction {
    const publicKeyOffset = 16;
    const signatureOffset = publicKeyOffset + publicKey.length;
    const messageOffset = signatureOffset + signature.length;
    const numSignatures = 1;

    const instructionData = Buffer.alloc(
        1 + // num_signatures
        1 + // padding
        2 + // signature_offset
        2 + // signature_instruction_index
        2 + // public_key_offset
        2 + // public_key_instruction_index  
        2 + // message_data_offset
        2 + // message_data_size
        2 + // message_instruction_index
        publicKey.length +
        signature.length +
        message.length
    );

    let offset = 0;

    // num_signatures
    instructionData.writeUInt8(numSignatures, offset);
    offset += 1;

    // padding
    instructionData.writeUInt8(0, offset);
    offset += 1;

    // signature_offset
    instructionData.writeUInt16LE(signatureOffset, offset);
    offset += 2;

    // signature_instruction_index (u16::MAX means current instruction)
    instructionData.writeUInt16LE(0xffff, offset);
    offset += 2;

    // public_key_offset
    instructionData.writeUInt16LE(publicKeyOffset, offset);
    offset += 2;

    // public_key_instruction_index
    instructionData.writeUInt16LE(0xffff, offset);
    offset += 2;

    // message_data_offset
    instructionData.writeUInt16LE(messageOffset, offset);
    offset += 2;

    // message_data_size
    instructionData.writeUInt16LE(message.length, offset);
    offset += 2;

    // message_instruction_index
    instructionData.writeUInt16LE(0xffff, offset);
    offset += 2;

    // Copy public key
    instructionData.set(publicKey, publicKeyOffset);

    // Copy signature
    instructionData.set(signature, signatureOffset);

    // Copy message
    instructionData.set(message, messageOffset);

    return new TransactionInstruction({
        keys: [],
        programId: new PublicKey("Ed25519SigVerify111111111111111111111111111"),
        data: instructionData,
    });
}

/**
 * Sign a message with a keypair
 */
export function sign(keypair: Keypair, message: Buffer): {
    signature: Uint8Array;
    address: Uint8Array;
} {
    const signature = nacl.sign.detached(message, keypair.secretKey);
    const address = keypair.publicKey.toBytes();

    return { signature, address };
}