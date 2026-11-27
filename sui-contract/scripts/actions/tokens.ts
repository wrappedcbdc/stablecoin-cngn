import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeploymentConfig } from './config';

/**
 * Executes standard coin minting to a recipient address (must be called by authorized minter with exact amount).
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
 * User self-burns their own cNGN Coin object for fiat redemption.
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
