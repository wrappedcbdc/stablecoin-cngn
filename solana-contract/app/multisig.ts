import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import * as multisig from "@sqds/multisig";
import { loadOrCreateKeypair } from './utils/helpers';

const { web3 } = anchor;

export async function createSquadsMultisig(
    connection: Connection,
    creator: Keypair
): Promise<{
    multisigPDA: PublicKey;
    vaultPDA: PublicKey;
    members: PublicKey[];
}> {
    const signer1 = loadOrCreateKeypair("signer1");
    const signer2 = loadOrCreateKeypair("signer2");
    
    const createKey = Keypair.generate();
    
    // Derive the multisig account PDA
    const [multisigPDA] = multisig.getMultisigPda({
        createKey: createKey.publicKey,
    });
    
    console.log("Creating Squads Multisig...");
    console.log("Multisig PDA:", multisigPDA.toBase58());
    
    try {
        // Check if multisig already exists
        const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
            connection,
            multisigPDA
        );
        console.log("Multisig already exists");
        
        // Get vault PDA
        const [vaultPDA] = multisig.getVaultPda({
            multisigPda: multisigPDA,
            index: 0,
        });
        
        return {
            multisigPDA,
            vaultPDA,
            members: [signer1.publicKey, signer2.publicKey],
        };
    } catch (error) {
        // Multisig doesn't exist, create it
        console.log("Multisig not found, creating new one...");
    }
    
    const programConfig = multisig.getProgramConfigPda({})[0];
    
    // Create the multisig
    const signature = await multisig.rpc.multisigCreateV2({
        connection,
        createKey: createKey,
        creator,
        multisigPda: multisigPDA,
        configAuthority: null,
        timeLock: 0,
        members: [
            {
                key: signer1.publicKey,
                permissions: multisig.types.Permissions.all(),
            },
            {
                key: signer2.publicKey,
                permissions: multisig.types.Permissions.all(),
            },
        ],
        threshold: 2,
        rentCollector: null,
        treasury: null,
        sendOptions: { skipPreflight: true },
        programId: multisig.PROGRAM_ID,
    });
    
    await connection.confirmTransaction(signature);
    console.log(`Created 2/2 Squads multisig: ${multisigPDA.toBase58()}`);
    console.log("Transaction signature:", signature);
    
    // Get vault PDA
    const [vaultPDA] = multisig.getVaultPda({
        multisigPda: multisigPDA,
        index: 0,
    });
    
    console.log("Vault PDA:", vaultPDA.toBase58());
    
    return {
        multisigPDA,
        vaultPDA,
        members: [signer1.publicKey, signer2.publicKey],
    };
}