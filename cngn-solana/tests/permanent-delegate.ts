import type { Program } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import { burnChecked, createAccount, getAccount, mintTo, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import type { Cngn } from '../target/types/cngn';
import { Keypair, PublicKey } from '@solana/web3.js';
import { calculatePDAs, TokenPDAs } from '../utils/helpers';
import { transferAuthorityToPDA } from './tranfer-authority-to-pda';
import { initializeToken, setupUserAccounts, TOKEN_PARAMS } from '../utils/token_initializer';
import { assert, expect } from 'chai';
describe('permanent-delegate', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cngn as Program<Cngn>;
  const payer = (provider.wallet as anchor.Wallet).payer;
  // Create the mint keypair - this will be the actual token
  const mint = Keypair.generate();

  // Create additional user keypairs for testing different scenarios
  const unauthorizedUser = Keypair.generate();
  const blacklistedUser = Keypair.generate();
  const authorizedUser = Keypair.generate();
  const blacklistedReceiver = Keypair.generate();

  // PDAs
  let pdas: TokenPDAs;
  let unauthorizedUserTokenAccount: PublicKey;
  let blacklistedUserTokenAccount: PublicKey;
  let authorizedUserTokenAccount: PublicKey;
  let blacklistedReceiverTokenAccount: PublicKey;

  // Token parameters
  const mintAmount = TOKEN_PARAMS.mintAmount;
  const differentMintAmount = new anchor.BN(500000000); // 500 tokens with 6 decimals

  before(async () => {
    // Calculate all PDAs for the token
    pdas = calculatePDAs(mint.publicKey, program.programId);

    // Initialize the token
    await initializeToken(program, provider, mint, pdas);

     let afterMintInfo=await transferAuthorityToPDA(pdas, mint, payer, provider)
      // Assertions to verify transfer
      assert(afterMintInfo.mintAuthority?.equals(pdas.mintAuthority), "Mint authority should be the PDA");
      assert(afterMintInfo.freezeAuthority?.equals(payer.publicKey), "Freeze authority should be the PDA");
    // Fund the test accounts
    // Airdrop SOL to the test accounts
    const users = [unauthorizedUser, blacklistedUser, authorizedUser, blacklistedReceiver];

    for (const user of users) {
      const airdropSignature = await provider.connection.requestAirdrop(
        user.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSignature);
    }
    console.log("======Setting up test users...========");

    // Create token accounts for all users
    const userAccounts = await setupUserAccounts(
      provider,
      users,
      mint.publicKey
    );

    [
      unauthorizedUserTokenAccount,
      blacklistedUserTokenAccount,
      authorizedUserTokenAccount,
      blacklistedReceiverTokenAccount
    ] = userAccounts;

    console.log("======Setting up test users...========");

    try {
      // Add the authorized user to can_mint with specific amount
      await program.methods
        .addCanMint(authorizedUser.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          blacklist: pdas.blacklist,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();

      // Set the mint amount for the authorized user
      await program.methods
        .setMintAmount(authorizedUser.publicKey, mintAmount)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenConfig: pdas.tokenConfig,
          canMint: pdas.canMint,
          trustedContracts: pdas.trustedContracts
        })
        .rpc();








      console.log("Test users set up successfully");
    } catch (error) {
      console.error("Error setting up test users:", error);
      throw error;
    }
  });

  it('Should burn with Permanent Delegate', async () => {
    // Record the balance before minting
    let tokenAccountInfoBefore;
    try {
      tokenAccountInfoBefore = await getAccount(provider.connection, authorizedUserTokenAccount);
    } catch (error) {
      tokenAccountInfoBefore = { amount: 0 };
    }

    // Create and send the mint transaction
    const mintTx = await program.methods
      .mint(mintAmount)
      .accounts({
        authority: authorizedUser.publicKey,
        tokenConfig: pdas.tokenConfig,
        mintAuthority: pdas.mintAuthority,
        mint: mint.publicKey,
        tokenAccount: blacklistedUserTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        blacklist: pdas.blacklist,
        canMint: pdas.canMint,
        trustedContracts: pdas.trustedContracts
      })
      .signers([authorizedUser])
      .rpc();

    console.log("Mint transaction signature:", mintTx);

    // Add the blacklisted user to blacklist
    await program.methods
      .addBlacklist(blacklistedUser.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        blacklist: pdas.blacklist
      })
      .rpc();
    await program.methods
      .destroyBlackFunds(mintAmount)
      .accounts({
        evilUser: blacklistedUserTokenAccount,
        authority: provider.wallet.publicKey,
        tokenConfig: pdas.tokenConfig,
        blacklist: pdas.blacklist,
        mint: mint.publicKey,
        mintAuthority: pdas.mintAuthority,
        tokenProgram: TOKEN_2022_PROGRAM_ID
      })
      .rpc();

    // Verify the tokens were minted correctly
    const tokenAccountInfoAfter = await getAccount(provider.connection, blacklistedReceiverTokenAccount, null, TOKEN_2022_PROGRAM_ID);

    assert.equal(
      tokenAccountInfoAfter.amount.toString(),
      new anchor.BN(0).toString(),
      "Token balance should zero"
    );

    // Verify the authorized user has been removed from can_mint list after successful minting
    const canMintAccountAfter = await program.account.canMint.fetch(pdas.canMint);
    const authorizedUserIndexAfter = canMintAccountAfter.authorities.findIndex(
      auth => auth.toString() === authorizedUser.publicKey.toString()
    );

    assert.equal(
      authorizedUserIndexAfter,
      -1,
      "Authorized user should be removed from can_mint list after minting"
    );
  });
});