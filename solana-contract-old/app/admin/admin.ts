import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Cngn } from '../../target/types/cngn';
import { TokenPDAs } from '../../utils/helpers';
import { TOKEN_PARAMS } from '../../utils/token_initializer';



/**
 * Set mint amount for a user
 */
export async function setMintAmountForUser(
  pdas: TokenPDAs,
  program: anchor.Program<Cngn>,
  provider: anchor.AnchorProvider,
  users: any
) {
  try {
    const tx = await program.methods.setMintAmount(users.authorizedUser.publicKey, TOKEN_PARAMS.mintAmount).accounts({
      authority: provider.wallet.publicKey,
      tokenConfig: pdas.tokenConfig,
      blacklist: pdas.blacklist,
      canMint: pdas.canMint,
      trustedContracts: pdas.trustedContracts
    }as any).rpc();

    console.log(`SetMintAmount transaction: ${tx}`);
    return tx;
  } catch (error) {
    console.error("Error setting user mint amount:", error);
    throw error;
  }
}

/**
 * Add a trusted contract
 */
export async function addTrustedContract(
  pdas: TokenPDAs,
  program: anchor.Program<Cngn>,
  provider: anchor.AnchorProvider,
  contract: PublicKey
) {
  try {
    const tx = await program.methods.addTrustedContract(contract).accounts({
      authority: provider.wallet.publicKey,
      tokenConfig: pdas.tokenConfig,
      trustedContracts: pdas.trustedContracts
    }as any).rpc();

    console.log(`AddTrustedContract transaction: ${tx}`);
    return tx;
  } catch (error) {
    console.error("Error adding trusted contract:", error);
    throw error;
  }
}

/**
 * Add a user to the blacklist
 */
export async function addBlacklist(
  pdas: TokenPDAs,
  program: anchor.Program<Cngn>,
  provider: anchor.AnchorProvider,
  users: any
) {
  try {
    const tx = await program.methods.addBlacklist(users.accountToBlacklist.publicKey).accounts({
      authority: provider.wallet.publicKey,
      tokenConfig: pdas.tokenConfig,
      blacklist: pdas.blacklist
    }as any).rpc();

    console.log(`AddBlacklist transaction: ${tx}`);
    return tx;
  } catch (error) {
    console.error("Error adding to blacklist:", error);
    throw error;
  }
}

/**
 * Whitelist an internal user
 */
export async function whitelistInternalUser(
  pdas: TokenPDAs,
  program: anchor.Program<Cngn>,
  provider: anchor.AnchorProvider,
  users: any
) {
  try {
    const tx = await program.methods.whitelistInternalUser(users.internalAccountToWhitelist.publicKey).accounts({
      authority: provider.wallet.publicKey,
      tokenConfig: pdas.tokenConfig,
      internalWhitelist: pdas.internalWhitelist,
      trustedContracts: pdas.trustedContracts
    }as any).rpc();

    console.log(`WhitelistInternalUser transaction: ${tx}`);
    return tx;
  } catch (error) {
    console.error("Error whitelisting internal user:", error);
    throw error;
  }
}

/**
 * Whitelist an external user
 */
export async function whitelistExternalUser(
  pdas: TokenPDAs,
  program: anchor.Program<Cngn>,
  provider: anchor.AnchorProvider,
  users:any
) {
  try {
    const tx = await program.methods.whitelistExternalUser(users.externalAccountToWhitelist.publicKey).accounts({
      authority: provider.wallet.publicKey,
      tokenConfig: pdas.tokenConfig,
      externalWhitelist: pdas.externalWhitelist,
      blacklist: pdas.blacklist
    }as any).rpc();

    console.log(`WhitelistExternalUser transaction: ${tx}`);
    return tx;
  } catch (error) {
    console.error("Error whitelisting external user:", error);
    throw error;
  }
}

/**
 * Add a user to the canForward list
 */
export async function addCanForward(
  pdas: TokenPDAs,
  program: anchor.Program<Cngn>,
  provider: anchor.AnchorProvider,
  users:any
) {
  try {
    const tx = await program.methods.addCanForward(users.forwarderToAdd.publicKey).accounts({
      authority: provider.wallet.publicKey,
      tokenConfig: pdas.tokenConfig,
      blacklist: pdas.blacklist,
      canForward: pdas.canForward
    }as any).rpc();

    console.log(`AddCanForward transaction: ${tx}`);
    return tx;
  } catch (error) {
    console.error("Error adding forwarder:", error);
    throw error;
  }
}
