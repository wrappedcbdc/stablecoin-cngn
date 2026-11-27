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
