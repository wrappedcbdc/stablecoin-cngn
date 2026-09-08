import { Provider } from "@coral-xyz/anchor";
import { AuthorityType, createSetAuthorityInstruction, getMint, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

export const transferAuthorityToPDA = async (pdas:any, mint: Keypair, payer: anchor.web3.Keypair, provider:any) => {

         // Verify the authorities were transferred
         const beforeMintInfo = await getMint(provider.connection, mint.publicKey,null, TOKEN_2022_PROGRAM_ID);
    
         console.log("Before Mint authority:", beforeMintInfo.mintAuthority?.toString());
         console.log("Before Freeze authority:", beforeMintInfo.freezeAuthority?.toString());
         console.log("Expected PDA:", pdas.mintAuthority?.toString());
        // Create transaction to transfer mint authority
        const transferMintAuthorityIx = createSetAuthorityInstruction(
          mint.publicKey,           // The mint
          provider.wallet.publicKey,        // Current authority (your wallet)
          AuthorityType.MintTokens,         // Authority type
          pdas.mintAuthority,                 // New authority (PDA)
          [payer],                               // No additional signers
          TOKEN_2022_PROGRAM_ID
        );
    
        // Create and send the transaction
        const tx = new anchor.web3.Transaction()
          .add(transferMintAuthorityIx)
    
    
        const signature = await provider.sendAndConfirm(tx);
        console.log("Transaction signature:", signature);
    
        // Verify the authorities were transferred
        const afterMintInfo = await getMint(provider.connection, mint.publicKey,null, TOKEN_2022_PROGRAM_ID);
    
        console.log("After Mint authority:", afterMintInfo.mintAuthority?.toString());
        console.log("After Freeze authority:", afterMintInfo.freezeAuthority?.toString());


        return afterMintInfo;
}