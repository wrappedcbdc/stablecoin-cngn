import {
    Connection,
    PublicKey,
    sendAndConfirmTransaction,
    Transaction,
} from '@solana/web3.js';

import {
    createSetAuthorityInstruction,
    AuthorityType,
    getMint,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';

import * as anchor from '@coral-xyz/anchor';


export const transferFreezeAuthority = async (
    freezeAuthority: PublicKey,
    mintAddress: PublicKey,
    payer: anchor.web3.Keypair,
    connection: Connection
) => {

    // Instruction to transfer freeze authority
    const transferFreezeAuthorityIx = createSetAuthorityInstruction(
        mintAddress,                       // Mint account
        payer.publicKey,                   // Current freeze authority
        AuthorityType.FreezeAccount,       // Freeze authority type
        freezeAuthority,             // New authority (PDA or wallet)
        [],                                // No multisig
        TOKEN_PROGRAM_ID
    );

    const tx = new Transaction().add(transferFreezeAuthorityIx);

    const sig = await sendAndConfirmTransaction(
        connection,
        tx,
        [payer]
    );

    console.log(`✅ Freeze authority transferred: ${sig}`);
    await verifyFreezeAuthority(connection, mintAddress, freezeAuthority);
};


const verifyFreezeAuthority = async (
    connection: Connection,
    mintAddress: PublicKey,
    expectedAuthority: PublicKey
) => {
    const mintInfo = await getMint(connection, mintAddress);

    console.log("=== Freeze Authority Check ===");
    console.log("Mint:", mintAddress.toString());
    console.log("Current Freeze Authority:", mintInfo.freezeAuthority?.toString() || "None");
    console.log("Expected:", expectedAuthority.toString());
    console.log(
        "Matches:",
        mintInfo.freezeAuthority?.equals(expectedAuthority) || false
    );
};
