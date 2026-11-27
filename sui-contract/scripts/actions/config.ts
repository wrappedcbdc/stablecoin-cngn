import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import * as fs from 'fs';
import * as path from 'path';

export const CONFIG_PATH = path.join(__dirname, '../../deployment.json');

export interface DeploymentConfig {
  packageId: string;
  upgradeCapId: string;
  adminCapId: string;
  adminRegistryId: string;
  coinStateId: string;
  coinMetadataId: string;
  denyListId: string;
  pasCoinStateId?: string;
  pasCoinMetadataId?: string;
  packageHistory?: string[];
}

export type SuiNetwork = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

export function loadDeploymentConfig(configPath: string = CONFIG_PATH): DeploymentConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Deployment config not found at ${configPath}. Run deploy script first.`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

export function createSuiClient(network: SuiNetwork = 'testnet'): SuiClient {
  return new SuiClient({ url: getFullnodeUrl(network) });
}
