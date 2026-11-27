import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeploymentConfig } from './config';

/**
 * User self-burns their own standard wallet Coin<CNGN> object for fiat redemption.
 */
export async function burnByUser(
  client: SuiClient,
  config: DeploymentConfig,
  userSigner: Ed25519Keypair,
  coinObjectId: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn::burn_by_user`,
    arguments: [
      tx.object(config.coinStateId),
      tx.object(config.denyListId),
      tx.object(coinObjectId),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: userSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Hybrid cNGN: Allows an account owner to self-burn their cNGN balance directly from their PAS Account.
 */
export async function burnFromPasAccount(
  client: SuiClient,
  config: DeploymentConfig,
  userSigner: Ed25519Keypair,
  policyId: string,
  accountId: string,
  amount: bigint
) {
  const tx = new Transaction();
  const auth = tx.moveCall({
    target: 'pas::account::new_auth',
    arguments: [],
  });
  tx.moveCall({
    target: `${config.packageId}::cngn::burn_from_pas_account`,
    arguments: [
      tx.object(config.coinStateId),
      tx.object(config.denyListId),
      tx.object(policyId),
      tx.object(accountId),
      auth,
      tx.pure.u64(amount),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: userSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Pure PAS cNGN: Allows an account owner to self-burn cNGN_PAS directly from their account.
 */
export async function burnFromPasAccountPurePas(
  client: SuiClient,
  config: DeploymentConfig,
  userSigner: Ed25519Keypair,
  policyId: string,
  accountId: string,
  amount: bigint
) {
  if (!config.pasCoinStateId) {
    throw new Error('pasCoinStateId not found in deployment config');
  }
  const tx = new Transaction();
  const auth = tx.moveCall({
    target: 'pas::account::new_auth',
    arguments: [],
  });
  tx.moveCall({
    target: `${config.packageId}::cngn_pas::burn_from_pas_account`,
    arguments: [
      tx.object(config.pasCoinStateId),
      tx.object(config.denyListId),
      tx.object(policyId),
      tx.object(accountId),
      auth,
      tx.pure.u64(amount),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: userSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}
