import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeploymentConfig } from './config';

// ==========================================
// Hybrid cNGN Compliance Operations
// ==========================================

/**
 * Freezes secondary market token transfers globally for hybrid cNGN.
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
 * Restores secondary market token transfers globally for hybrid cNGN.
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
 * Adds an address to the validator-enforced DenyList for hybrid cNGN.
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
 * Removes an address from the validator-enforced DenyList for hybrid cNGN.
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

// ==========================================
// Pure PAS cNGN Compliance Operations
// ==========================================

/**
 * Freezes transfers globally for pure cNGN_PAS.
 */
export async function pausePurePas(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair
) {
  if (!config.pasCoinStateId) {
    throw new Error('pasCoinStateId not found in deployment config');
  }
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn_pas::pause`,
    arguments: [
      tx.object(config.pasCoinStateId),
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
 * Restores transfers globally for pure cNGN_PAS.
 */
export async function unpausePurePas(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair
) {
  if (!config.pasCoinStateId) {
    throw new Error('pasCoinStateId not found in deployment config');
  }
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn_pas::unpause`,
    arguments: [
      tx.object(config.pasCoinStateId),
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
 * Adds an address to the validator-enforced DenyList for pure cNGN_PAS.
 */
export async function addBlacklistPurePas(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair,
  targetAddress: string
) {
  if (!config.pasCoinStateId) {
    throw new Error('pasCoinStateId not found in deployment config');
  }
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn_pas::add_black_list`,
    arguments: [
      tx.object(config.pasCoinStateId),
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
 * Removes an address from the validator-enforced DenyList for pure cNGN_PAS.
 */
export async function removeBlacklistPurePas(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair,
  targetAddress: string
) {
  if (!config.pasCoinStateId) {
    throw new Error('pasCoinStateId not found in deployment config');
  }
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn_pas::remove_black_list`,
    arguments: [
      tx.object(config.pasCoinStateId),
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
