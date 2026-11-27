import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeploymentConfig } from './config';

/**
 * Grants a minter single-use mint authority for an exact amount.
 */
export async function grantMintPermission(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair,
  minterAddress: string,
  amount: bigint
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::admin::grant_mint_permission`,
    arguments: [
      tx.object(config.adminRegistryId),
      tx.object(config.adminCapId),
      tx.pure.address(minterAddress),
      tx.pure.u64(amount),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: adminSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Revokes mint authority from a minter.
 */
export async function revokeMintPermission(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair,
  minterAddress: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::admin::revoke_mint_permission`,
    arguments: [
      tx.object(config.adminRegistryId),
      tx.object(config.adminCapId),
      tx.pure.address(minterAddress),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: adminSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Hybrid cNGN: Mints standard Coin<CNGN> to a recipient wallet address.
 */
export async function mint(
  client: SuiClient,
  config: DeploymentConfig,
  minterSigner: Ed25519Keypair,
  amount: bigint,
  recipientAddress: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn::mint`,
    arguments: [
      tx.object(config.coinStateId),
      tx.object(config.adminRegistryId),
      tx.object(config.denyListId),
      tx.pure.u64(amount),
      tx.pure.address(recipientAddress),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: minterSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Hybrid cNGN: Mints tokens directly into a recipient's PAS Account.
 */
export async function mintToAccount(
  client: SuiClient,
  config: DeploymentConfig,
  minterSigner: Ed25519Keypair,
  toAccountId: string,
  amount: bigint
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn::mint_to_account`,
    arguments: [
      tx.object(config.coinStateId),
      tx.object(config.adminRegistryId),
      tx.object(config.denyListId),
      tx.object(toAccountId),
      tx.pure.u64(amount),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: minterSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Pure PAS cNGN: Mints cNGN_PAS tokens directly into a recipient's PAS Account.
 */
export async function mintToAccountPurePas(
  client: SuiClient,
  config: DeploymentConfig,
  minterSigner: Ed25519Keypair,
  toAccountId: string,
  amount: bigint
) {
  if (!config.pasCoinStateId) {
    throw new Error('pasCoinStateId not found in deployment config');
  }
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn_pas::mint_to_account`,
    arguments: [
      tx.object(config.pasCoinStateId),
      tx.object(config.adminRegistryId),
      tx.object(config.denyListId),
      tx.object(toAccountId),
      tx.pure.u64(amount),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: minterSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}
