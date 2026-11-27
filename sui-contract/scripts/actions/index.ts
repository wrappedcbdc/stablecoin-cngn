import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  DeploymentConfig,
  SuiNetwork,
  createSuiClient,
  loadDeploymentConfig,
} from './config';

import * as mintActions from './mint';
import * as transferActions from './transfer';
import * as burnActions from './burn';
import * as clawbackActions from './clawback';
import * as complianceActions from './compliance';
import * as policyActions from './policy';
import * as queryActions from './queries';

// Re-export all individual action modules & config
export * from './config';
export * from './mint';
export * from './transfer';
export * from './burn';
export * from './clawback';
export * from './compliance';
export * from './policy';
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

  // ==========================================
  // Minting Operations
  // ==========================================

  async grantMintPermission(adminSigner: Ed25519Keypair, minterAddress: string, amount: bigint) {
    return mintActions.grantMintPermission(this.client, this.config, adminSigner, minterAddress, amount);
  }

  async revokeMintPermission(adminSigner: Ed25519Keypair, minterAddress: string) {
    return mintActions.revokeMintPermission(this.client, this.config, adminSigner, minterAddress);
  }

  async mint(minterSigner: Ed25519Keypair, amount: bigint, recipientAddress: string) {
    return mintActions.mint(this.client, this.config, minterSigner, amount, recipientAddress);
  }

  async mintToAccount(minterSigner: Ed25519Keypair, toAccountId: string, amount: bigint) {
    return mintActions.mintToAccount(this.client, this.config, minterSigner, toAccountId, amount);
  }

  async mintToAccountPurePas(minterSigner: Ed25519Keypair, toAccountId: string, amount: bigint) {
    return mintActions.mintToAccountPurePas(this.client, this.config, minterSigner, toAccountId, amount);
  }

  // ==========================================
  // Transfer Operations
  // ==========================================

  async transferCoin(senderSigner: Ed25519Keypair, coinObjectId: string, recipientAddress: string) {
    return transferActions.transferCoin(this.client, senderSigner, coinObjectId, recipientAddress);
  }

  async depositCoinToAccount(userSigner: Ed25519Keypair, accountId: string, coinObjectId: string) {
    return transferActions.depositCoinToAccount(this.client, this.config, userSigner, accountId, coinObjectId);
  }

  async sendPasBalance(
    userSigner: Ed25519Keypair,
    policyId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: bigint
  ) {
    return transferActions.sendPasBalance(this.client, this.config, userSigner, policyId, fromAccountId, toAccountId, amount);
  }

  async sendPasBalancePurePas(
    userSigner: Ed25519Keypair,
    policyId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: bigint
  ) {
    return transferActions.sendPasBalancePurePas(this.client, this.config, userSigner, policyId, fromAccountId, toAccountId, amount);
  }

  // ==========================================
  // Burn Operations
  // ==========================================

  async burnByUser(userSigner: Ed25519Keypair, coinObjectId: string) {
    return burnActions.burnByUser(this.client, this.config, userSigner, coinObjectId);
  }

  async burnFromPasAccount(userSigner: Ed25519Keypair, policyId: string, accountId: string, amount: bigint) {
    return burnActions.burnFromPasAccount(this.client, this.config, userSigner, policyId, accountId, amount);
  }

  async burnFromPasAccountPurePas(userSigner: Ed25519Keypair, policyId: string, accountId: string, amount: bigint) {
    return burnActions.burnFromPasAccountPurePas(this.client, this.config, userSigner, policyId, accountId, amount);
  }

  // ==========================================
  // Clawback & Regulatory Destroy Operations
  // ==========================================

  async destroyBlackFunds(adminSigner: Ed25519Keypair, policyId: string, fromAccountId: string, amount: bigint) {
    return clawbackActions.destroyBlackFunds(this.client, this.config, adminSigner, policyId, fromAccountId, amount);
  }

  async destroyBlackFundsPurePas(adminSigner: Ed25519Keypair, policyId: string, fromAccountId: string, amount: bigint) {
    return clawbackActions.destroyBlackFundsPurePas(this.client, this.config, adminSigner, policyId, fromAccountId, amount);
  }

  // ==========================================
  // Compliance & Circuit Breakers
  // ==========================================

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

  async pausePurePas(adminSigner: Ed25519Keypair) {
    return complianceActions.pausePurePas(this.client, this.config, adminSigner);
  }

  async unpausePurePas(adminSigner: Ed25519Keypair) {
    return complianceActions.unpausePurePas(this.client, this.config, adminSigner);
  }

  async addBlacklistPurePas(adminSigner: Ed25519Keypair, targetAddress: string) {
    return complianceActions.addBlacklistPurePas(this.client, this.config, adminSigner, targetAddress);
  }

  async removeBlacklistPurePas(adminSigner: Ed25519Keypair, targetAddress: string) {
    return complianceActions.removeBlacklistPurePas(this.client, this.config, adminSigner, targetAddress);
  }

  // ==========================================
  // Policy Administration
  // ==========================================

  async setupPasPolicy(adminSigner: Ed25519Keypair, namespaceId: string) {
    return policyActions.setupPasPolicy(this.client, this.config, adminSigner, namespaceId);
  }

  async setupPasPolicyPurePas(adminSigner: Ed25519Keypair, namespaceId: string) {
    return policyActions.setupPasPolicyPurePas(this.client, this.config, adminSigner, namespaceId);
  }

  // ==========================================
  // State & Metadata Queries
  // ==========================================

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
