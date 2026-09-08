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
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID
} from '@solana/spl-token';

import * as anchor from '@coral-xyz/anchor';


export const transferMintAuthority = async (mintAuthority: PublicKey, mintAddress: PublicKey, payer: anchor.web3.Keypair, connection: Connection) => {

    // Create a transaction to transfer mint authority
    const transferMintAuthorityIx = createSetAuthorityInstruction(
        mintAddress,             // The mint account
        payer.publicKey,                  // Current authority (your wallet)
        AuthorityType.MintTokens,          // Authority type to transfer
        mintAuthority,                  // New authority (the PDA)
        [],                                // Additional signers (none needed)
        TOKEN_2022_PROGRAM_ID                   // Token program ID
    );


    // Combine instructions into a transaction
    const transaction = new Transaction()
        .add(transferMintAuthorityIx)

    // Sign and send the transaction
    const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer]
    );

    console.log(`Authority transfer complete: ${signature}`);
   await verifyMintAuthorities(connection, mintAddress, mintAuthority);
};


const verifyMintAuthorities = async (connection: Connection,mintAddress:PublicKey,expectedMintAuthorityPDA:PublicKey) => {


    
    try {
      // Fetch the mint info
      const mintInfo = await getMint(
        connection,
        mintAddress
      );
      
      console.log('=== Mint Authority Information ===');
      console.log(`Mint Address: ${mintAddress.toString()}`);
      console.log(`Mint Authority: ${mintInfo.mintAuthority?.toString() || 'None'}`);
      console.log(`Freeze Authority: ${mintInfo.freezeAuthority?.toString() || 'None'}`);
      console.log(`Supply: ${mintInfo.supply}`);
      console.log(`Decimals: ${mintInfo.decimals}`);
      console.log(`Is Initialized: ${mintInfo.isInitialized}`);
      
     
      
      console.log('=== Verification ===');
      console.log(`Expected Mint Authority PDA: ${expectedMintAuthorityPDA.toString()}`);
      console.log(`Matches current mint authority: ${mintInfo.mintAuthority?.equals(expectedMintAuthorityPDA) || false}`);
      
    } catch (error) {
      console.error('Error fetching mint information:', error);
    }
  };
  
