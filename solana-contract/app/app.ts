import * as anchor from '@coral-xyz/anchor';

import fs from 'fs';
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { calculatePDAs, TokenPDAs } from '../utils/helpers';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { mintTokens } from './mint';

import idl from '../target/idl/cngn.json';
import { Cngn } from '../target/types/cngn';
import { giveUserMintingPriviledge,removeUserMintingPriviledge } from './admin/mint';


const { web3 } = anchor;

// Convert string to PublicKey
const mintPublicKey = new PublicKey("3KRMj39YGU4uPtYA4rRYA93tafGPjB71miWRq1RcV5nQ");

//const programId = new PublicKey("4qgc4qUsecrsXdu1oof3YScMDbH1Ck6NsByLbEARHR4D")

const users = {
    sender: Keypair.generate(),
    recipient: Keypair.generate(),
    authorizedUser: Keypair.generate(),
    contract: Keypair.generate(),
    internalAccountToBlacklist: Keypair.generate(),
    externalAccountToWhitelist: Keypair.generate(),
    forwarderToAdd: Keypair.generate(),
};




async function main() {
    console.log("Starting main function");
    try {
        const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");

        // Configure the connection to the cluster
        const provider = new anchor.AnchorProvider(
            connection,
            anchor.Wallet.local(),
            { commitment: "confirmed" }
        );

        anchor.setProvider(provider);
        const payer = (provider.wallet as anchor.Wallet).payer;

        // Load the IDL JSON file
        const program = new anchor.Program(idl as Cngn, provider);



        let pdas: TokenPDAs;
        // Calculate all PDAs for the token
        pdas = calculatePDAs(mintPublicKey, program.programId);
        await giveUserMintingPriviledge(pdas, program, provider, users)
        await removeUserMintingPriviledge(pdas, program, provider, users)
        await giveUserMintingPriviledge(pdas, program, provider, users)
        // // 1. Mint 100 tokens to the payer's wallet
        // await mintTokens(
        //     pdas,
        //     program,
        //     mintPublicKey,
        //     users,
        //     payer
        // );

        // // 2. Create a new recipient
        // const recipient = Keypair.generate();

        // // Fund the recipient with some SOL for account creation
        // const airdropSignature = await connection.requestAirdrop(
        //   recipient.publicKey,
        //   LAMPORTS_PER_SOL / 10
        // );
        // await connection.confirmTransaction(airdropSignature);

        // // 3. Transfer 50 tokens to recipient
        // await transferTokens(
        //   program,
        //   mintPublicKey,
        //   payer.publicKey,
        //   recipient.publicKey,
        //   50,
        //   payer
        // );

        // // 4. Burn 20 tokens from payer's wallet
        // await burnTokens(
        //   program,
        //   mintPublicKey,
        //   payer.publicKey,
        //   20,
        //   payer
        // );


    } catch (error) {
        console.error("Error in main function:", error);
    }
}

// Execute the main function
main().then(
    () => process.exit(0),
    err => {
        console.error(err);
        process.exit(1);
    }
);

function removeCanMint(pdas: TokenPDAs, program: anchor.Program<Cngn>, provider: anchor.AnchorProvider, users: { sender: anchor.web3.Keypair; recipient: anchor.web3.Keypair; authorizedUser: anchor.web3.Keypair; contract: anchor.web3.Keypair; internalAccountToBlacklist: anchor.web3.Keypair; externalAccountToWhitelist: anchor.web3.Keypair; forwarderToAdd: anchor.web3.Keypair; }) {
    throw new Error('Function not implemented.');
}
