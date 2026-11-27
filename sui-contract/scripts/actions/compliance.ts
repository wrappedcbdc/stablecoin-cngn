import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeploymentConfig } from './config';

/**
 * Freezes secondary market token transfers globally.
 */
export async function pause(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn::pause`,
    arguments: [
      tx.object(config.coinStateId),
      tx.object(config.adminCapId),
      tx.object(config.denyListId),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: adminSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Restores secondary market token transfers globally.
 */
export async function unpause(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn::unpause`,
    arguments: [
      tx.object(config.coinStateId),
      tx.object(config.adminCapId),
      tx.object(config.denyListId),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: adminSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Adds an address to the validator-enforced DenyList.
 */
export async function addBlacklist(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair,
  targetAddress: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn::add_black_list`,
    arguments: [
      tx.object(config.coinStateId),
      tx.object(config.adminCapId),
      tx.object(config.denyListId),
      tx.pure.address(targetAddress),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: adminSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Removes an address from the validator-enforced DenyList.
 */
export async function removeBlacklist(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair,
  targetAddress: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn::remove_black_list`,
    arguments: [
      tx.object(config.coinStateId),
      tx.object(config.adminCapId),
      tx.object(config.denyListId),
      tx.pure.address(targetAddress),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: adminSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}
