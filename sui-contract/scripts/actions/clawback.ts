import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeploymentConfig } from './config';

/**
 * Hybrid cNGN: Admin claws back and burns cNGN from a blacklisted user's PAS Account.
 * Requires target user to be on the DenyList.
 */
export async function destroyBlackFunds(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair,
  policyId: string,
  fromAccountId: string,
  amount: bigint
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn::destroy_black_funds`,
    arguments: [
      tx.object(config.coinStateId),
      tx.object(config.adminCapId),
      tx.object(policyId),
      tx.object(fromAccountId),
      tx.object(config.denyListId),
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
 * Pure PAS cNGN: Admin claws back and burns cNGN_PAS from a blacklisted user's PAS Account.
 * Requires target user to be on the DenyList.
 */
export async function destroyBlackFundsPurePas(
  client: SuiClient,
  config: DeploymentConfig,
  adminSigner: Ed25519Keypair,
  policyId: string,
  fromAccountId: string,
  amount: bigint
) {
  if (!config.pasCoinStateId) {
    throw new Error('pasCoinStateId not found in deployment config');
  }
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn_pas::destroy_black_funds`,
    arguments: [
      tx.object(config.pasCoinStateId),
      tx.object(config.adminCapId),
      tx.object(policyId),
      tx.object(fromAccountId),
      tx.object(config.denyListId),
      tx.pure.u64(amount),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: adminSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}
