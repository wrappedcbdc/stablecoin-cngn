import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  DeploymentConfig,
  SuiNetwork,
  createSuiClient,
  loadDeploymentConfig,
} from './config';
import * as adminActions from './admin';
import * as tokenActions from './tokens';
import * as complianceActions from './compliance';
import * as pasActions from './pas';
import * as queryActions from './queries';

// Re-export all modular actions and config types
export * from './config';
export * from './admin';
export * from './tokens';
export * from './compliance';
export * from './pas';
export * from './queries';

/**
 * Unified Client Facade aggregating all actions across modules.
 */
export class CNGNClient {
  public client: SuiClient;
  public config: DeploymentConfig;

  constructor(network: SuiNetwork = 'testnet', customConfig?: DeploymentConfig) {
    this.client = createSuiClient(network);
    this.config = customConfig || loadDeploymentConfig();
  }

  // --- Admin Mint Grants ---
  async grantMintPermission(adminSigner: Ed25519Keypair, minterAddress: string, amount: bigint) {
    return adminActions.grantMintPermission(this.client, this.config, adminSigner, minterAddress, amount);
  }

  async revokeMintPermission(adminSigner: Ed25519Keypair, minterAddress: string) {
    return adminActions.revokeMintPermission(this.client, this.config, adminSigner, minterAddress);
  }

  // --- Token Mint & Burn ---
  async mint(minterSigner: Ed25519Keypair, amount: bigint, recipientAddress: string) {
    return tokenActions.mint(this.client, this.config, minterSigner, amount, recipientAddress);
  }

  async burnByUser(userSigner: Ed25519Keypair, coinObjectId: string) {
    return tokenActions.burnByUser(this.client, this.config, userSigner, coinObjectId);
  }

  // --- Emergency & Compliance ---
  async pause(adminSigner: Ed25519Keypair) {
    return complianceActions.pause(this.client, this.config, adminSigner);
  }

  async unpause(adminSigner: Ed25519Keypair) {
    return complianceActions.unpause(this.client, this.config, adminSigner);
  }

  async addBlacklist(adminSigner: Ed25519Keypair, targetAddress: string) {
    return complianceActions.addBlacklist(this.client, this.config, adminSigner, targetAddress);
  }

  async removeBlacklist(adminSigner: Ed25519Keypair, targetAddress: string) {
    return complianceActions.removeBlacklist(this.client, this.config, adminSigner, targetAddress);
  }

  // --- PAS Operations (Hybrid) ---
  async setupPasPolicy(adminSigner: Ed25519Keypair, namespaceId: string) {
    return pasActions.setupPasPolicy(this.client, this.config, adminSigner, namespaceId);
  }

  async mintToAccount(minterSigner: Ed25519Keypair, toAccountId: string, amount: bigint) {
    return pasActions.mintToAccount(this.client, this.config, minterSigner, toAccountId, amount);
  }

  async depositCoinToAccount(userSigner: Ed25519Keypair, accountId: string, coinObjectId: string) {
    return pasActions.depositCoinToAccount(this.client, this.config, userSigner, accountId, coinObjectId);
  }

  async burnFromPasAccount(userSigner: Ed25519Keypair, policyId: string, accountId: string, amount: bigint) {
    return pasActions.burnFromPasAccount(this.client, this.config, userSigner, policyId, accountId, amount);
  }

  async destroyBlackFunds(adminSigner: Ed25519Keypair, policyId: string, fromAccountId: string, amount: bigint) {
    return pasActions.destroyBlackFunds(this.client, this.config, adminSigner, policyId, fromAccountId, amount);
  }

  // --- Pure PAS Operations (cngn_pas) ---
  async mintToAccountPurePas(minterSigner: Ed25519Keypair, toAccountId: string, amount: bigint) {
    return pasActions.mintToAccountPurePas(this.client, this.config, minterSigner, toAccountId, amount);
  }

  async burnFromPasAccountPurePas(userSigner: Ed25519Keypair, policyId: string, accountId: string, amount: bigint) {
    return pasActions.burnFromPasAccountPurePas(this.client, this.config, userSigner, policyId, accountId, amount);
  }

  async destroyBlackFundsPurePas(adminSigner: Ed25519Keypair, policyId: string, fromAccountId: string, amount: bigint) {
    return pasActions.destroyBlackFundsPurePas(this.client, this.config, adminSigner, policyId, fromAccountId, amount);
  }

  // --- Queries ---
  async getCoinState() {
    return queryActions.getCoinState(this.client, this.config);
  }

  async getPasCoinState() {
    return queryActions.getPasCoinState(this.client, this.config);
  }

  async getAdminRegistry() {
    return queryActions.getAdminRegistry(this.client, this.config);
  }

  async getCoinMetadata() {
    return queryActions.getCoinMetadata(this.client, this.config);
  }

  async getPasCoinMetadata() {
    return queryActions.getPasCoinMetadata(this.client, this.config);
  }
}
