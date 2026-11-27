import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeploymentConfig } from './config';

// ==========================================
// Hybrid cNGN PAS Operations
// ==========================================

/**
 * Initializes the PAS Policy for cNGN on a shared Namespace.
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
 * Mints tokens directly into a recipient's PAS Account.
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
 * Deposits a standard Coin<CNGN> into a PAS Account.
 */
export async function depositCoinToAccount(
  client: SuiClient,
  config: DeploymentConfig,
  userSigner: Ed25519Keypair,
  accountId: string,
  coinObjectId: string
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::cngn::deposit_coin_to_account`,
    arguments: [
      tx.object(accountId),
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
 * Allows an account owner to self-burn their cNGN balance directly from their PAS Account.
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
 * Admin claws back and burns cNGN from a blacklisted user's PAS account.
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

// ==========================================
// Pure PAS Module Operations (cngn_pas)
// ==========================================

/**
 * Mints directly into an account using the pure cngn_pas module.
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

/**
 * Self-burns directly from account using the pure cngn_pas module.
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

/**
 * Regulatory clawback & burn using the pure cngn_pas module.
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
