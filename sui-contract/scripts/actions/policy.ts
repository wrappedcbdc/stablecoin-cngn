import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeploymentConfig } from './config';

/**
 * Hybrid cNGN: Initializes the PAS Policy for cNGN on a shared Namespace.
 * Sets up required approvals for send_funds, clawback_funds, and unlock_funds.
 */
export async function setupPasPolicy(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair,
  namespaceId: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn::setup_pas_policy`,
    arguments: [
      tx.object(config.coinStateId),
      tx.object(config.adminCapId),
      tx.object(namespaceId),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: adminSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Pure PAS cNGN: Initializes the PAS Policy for cNGN_PAS on a shared Namespace.
 */
export async function setupPasPolicyPurePas(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair,
  namespaceId: string
) {
  if (!config.pasCoinStateId) {
    throw new Error('pasCoinStateId not found in deployment config');
  }
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn_pas::setup_pas_policy`,
    arguments: [
      tx.object(config.pasCoinStateId),
      tx.object(config.adminCapId),
      tx.object(namespaceId),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: adminSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}
