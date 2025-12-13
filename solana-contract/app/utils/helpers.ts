import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import fs from "fs";
import path from "path";

export async function transferSol(
    connection: anchor.web3.Connection,
    fromWallet: anchor.web3.Keypair,
    toPublicKey: PublicKey,
    amountSol: number
) {
    const tx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
            fromPubkey: fromWallet.publicKey,
            toPubkey: toPublicKey,
            lamports: amountSol * anchor.web3.LAMPORTS_PER_SOL,
        })
    );

    const signature = await anchor.web3.sendAndConfirmTransaction(
        connection,
        tx,
        [fromWallet]
    );

    console.log(`Transferred ${amountSol} SOL to ${toPublicKey.toBase58()} - Signature: ${signature}`);
}




const KEY_DIR = path.join(process.cwd(), "keys");

export function loadOrCreateKeypair(name: string): Keypair {
    if (!fs.existsSync(KEY_DIR)) {
        fs.mkdirSync(KEY_DIR);
    }

    const filePath = path.join(KEY_DIR, `${name}.json`);

    // If file exists → load it
    if (fs.existsSync(filePath)) {
        const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return Keypair.fromSecretKey(Uint8Array.from(json.secretKey));
    }

    // Otherwise generate and save
    const keypair = Keypair.generate();
    const data = {
        publicKey: keypair.publicKey.toBase58(),
        secretKey: Array.from(keypair.secretKey),
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Created new key: ${filePath}`);

    return keypair;
}