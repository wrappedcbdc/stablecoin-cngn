import { SuiClient } from '@mysten/sui/client';
import { DeploymentConfig } from './config';

/**
 * Fetches the shared CoinState object for hybrid cNGN.
 */
export async function getCoinState(client: SuiClient, config: DeploymentConfig) {
  return await client.getObject({
    id: config.coinStateId,
    options: { showContent: true },
  });
}

/**
 * Fetches the shared CoinState object for pure cNGN PAS.
 */
export async function getPasCoinState(client: SuiClient, config: DeploymentConfig) {
  if (!config.pasCoinStateId) {
    throw new Error('pasCoinStateId not found in deployment config');
  }
  return await client.getObject({
    id: config.pasCoinStateId,
    options: { showContent: true },
  });
}

/**
 * Fetches the shared AdminRegistry object.
 */
export async function getAdminRegistry(client: SuiClient, config: DeploymentConfig) {
  return await client.getObject({
    id: config.adminRegistryId,
    options: { showContent: true },
  });
}

/**
 * Fetches the CoinMetadata object for hybrid cNGN.
 */
export async function getCoinMetadata(client: SuiClient, config: DeploymentConfig) {
  return await client.getObject({
    id: config.coinMetadataId,
    options: { showContent: true },
  });
}

/**
 * Fetches the CoinMetadata object for pure cNGN PAS.
 */
export async function getPasCoinMetadata(client: SuiClient, config: DeploymentConfig) {
  if (!config.pasCoinMetadataId) {
    throw new Error('pasCoinMetadataId not found in deployment config');
  }
  return await client.getObject({
    id: config.pasCoinMetadataId,
    options: { showContent: true },
  });
}
