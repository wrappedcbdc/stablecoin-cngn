import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeploymentConfig } from './config';

/**
 * Transfers a standard Coin<CNGN> directly to a recipient wallet address.
 */
export async function transferCoin(
  client: SuiClient,
  senderSigner: Ed25519Keypair,
  coinObjectId: string,
  recipientAddress: string
) {
  const tx = new Transaction();
  tx.transferObjects([tx.object(coinObjectId)], tx.pure.address(recipientAddress));

  return await client.signAndExecuteTransaction({
    signer: senderSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Deposits a standard wallet Coin<CNGN> into a PAS Account.
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
 * Hybrid cNGN: Transfers balance from one PAS Account to another with compliance approval.
 */
export async function sendPasBalance(
  client: SuiClient,
  config: DeploymentConfig,
  userSigner: Ed25519Keypair,
  policyId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: bigint
) {
  const tx = new Transaction();
  const auth = tx.moveCall({
    target: 'pas::account::new_auth',
    arguments: [],
  });

  // 1. Initiate transfer request
  const request = tx.moveCall({
    target: 'pas::account::send_balance',
    typeArguments: [`${config.packageId}::cngn::CNGN`],
    arguments: [
      tx.object(fromAccountId),
      auth,
      tx.object(toAccountId),
      tx.pure.u64(amount),
    ],
  });

  // 2. Attach TransferApproval stamp
  tx.moveCall({
    target: `${config.packageId}::cngn::approve_pas_transfer`,
    arguments: [
      tx.object(config.denyListId),
      request,
    ],
  });

  // 3. Resolve transfer into recipient account
  tx.moveCall({
    target: 'pas::send_funds::resolve_balance',
    typeArguments: [`${config.packageId}::cngn::CNGN`],
    arguments: [
      request,
      tx.object(policyId),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: userSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Pure PAS cNGN: Transfers balance between accounts using cngn_pas compliance approval.
 */
export async function sendPasBalancePurePas(
  client: SuiClient,
  config: DeploymentConfig,
  userSigner: Ed25519Keypair,
  policyId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: bigint
) {
  const tx = new Transaction();
  const auth = tx.moveCall({
    target: 'pas::account::new_auth',
    arguments: [],
  });

  // 1. Initiate transfer request
  const request = tx.moveCall({
    target: 'pas::account::send_balance',
    typeArguments: [`${config.packageId}::cngn_pas::CNGN_PAS`],
    arguments: [
      tx.object(fromAccountId),
      auth,
      tx.object(toAccountId),
      tx.pure.u64(amount),
    ],
  });

  // 2. Attach TransferApproval stamp
  tx.moveCall({
    target: `${config.packageId}::cngn_pas::approve_pas_transfer`,
    arguments: [
      tx.object(config.denyListId),
      request,
    ],
  });

  // 3. Resolve transfer into recipient account
  tx.moveCall({
    target: 'pas::send_funds::resolve_balance',
    typeArguments: [`${config.packageId}::cngn_pas::CNGN_PAS`],
    arguments: [
      request,
      tx.object(policyId),
    ],
  });

  return await client.signAndExecuteTransaction({
    signer: userSigner,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}
