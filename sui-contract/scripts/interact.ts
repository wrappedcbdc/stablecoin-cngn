import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration & Constants ---
const CONFIG_PATH = path.join(__dirname, '../deployment.json');

interface DeploymentConfig {
  packageId: string;
  upgradeCapId: string;
  adminCapId: string;
  adminRegistryId: string;
  coinStateId: string;
  coinMetadataId: string;
  denyListId: string;
}

export class CNGNClient {
  private client: SuiClient;
  private config: DeploymentConfig;

  constructor(network: 'mainnet' | 'testnet' | 'devnet' | 'localnet' = 'testnet') {
    this.client = new SuiClient({ url: getFullnodeUrl(network) });
    if (!fs.existsSync(CONFIG_PATH)) {
      throw new Error(`Deployment config not found at ${CONFIG_PATH}. Run deploy script first.`);
    }
    this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  }

  // ==========================================
  // 1. Admin Mint Grant Management (Object first, Cap second)
  // ==========================================

  /**
   * Grants a minter single-use mint authority for an exact amount.
   */
  async grantMintPermission(adminSigner: Ed25519Keypair, minterAddress: string, amount: bigint) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::admin::grant_mint_permission`,
      arguments: [
        tx.object(this.config.adminRegistryId),
        tx.object(this.config.adminCapId),
        tx.pure.address(minterAddress),
        tx.pure.u64(amount),
      ],
    });

    return await this.client.signAndExecuteTransaction({
      signer: adminSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  /**
   * Revokes mint authority from a minter.
   */
  async revokeMintPermission(adminSigner: Ed25519Keypair, minterAddress: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::admin::revoke_mint_permission`,
      arguments: [
        tx.object(this.config.adminRegistryId),
        tx.object(this.config.adminCapId),
        tx.pure.address(minterAddress),
      ],
    });

    return await this.client.signAndExecuteTransaction({
      signer: adminSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  // ==========================================
  // 2. Token Minting & Burning
  // ==========================================

  /**
   * Executes minting to a recipient (must be called by authorized minter with exact amount).
   */
  async mint(minterSigner: Ed25519Keypair, amount: bigint, recipientAddress: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn::mint`,
      arguments: [
        tx.object(this.config.coinStateId),
        tx.object(this.config.adminRegistryId),
        tx.object(this.config.denyListId),
        tx.pure.u64(amount),
        tx.pure.address(recipientAddress),
      ],
    });

    return await this.client.signAndExecuteTransaction({
      signer: minterSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  /**
   * User self-burns their own cNGN Coin object for fiat redemption.
   */
  async burnByUser(userSigner: Ed25519Keypair, coinObjectId: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn::burn_by_user`,
      arguments: [
        tx.object(this.config.coinStateId),
        tx.object(coinObjectId),
      ],
    });

    return await this.client.signAndExecuteTransaction({
      signer: userSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  // ==========================================
  // 3. Emergency Circuit Breakers (Pause / Unpause: Object first, Cap second)
  // ==========================================

  /**
   * Freezes secondary market token transfers globally.
   */
  async pause(adminSigner: Ed25519Keypair) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn::pause`,
      arguments: [
        tx.object(this.config.coinStateId),
        tx.object(this.config.adminCapId),
        tx.object(this.config.denyListId),
      ],
    });

    return await this.client.signAndExecuteTransaction({
      signer: adminSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  /**
   * Restores secondary market token transfers globally.
   */
  async unpause(adminSigner: Ed25519Keypair) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn::unpause`,
      arguments: [
        tx.object(this.config.coinStateId),
        tx.object(this.config.adminCapId),
        tx.object(this.config.denyListId),
      ],
    });

    return await this.client.signAndExecuteTransaction({
      signer: adminSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  // ==========================================
  // 4. Compliance & DenyList Sanctions (Object first, Cap second)
  // ==========================================

  /**
   * Adds an address to the validator-enforced DenyList.
   */
  async addBlacklist(adminSigner: Ed25519Keypair, targetAddress: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn::add_black_list`,
      arguments: [
        tx.object(this.config.coinStateId),
        tx.object(this.config.adminCapId),
        tx.object(this.config.denyListId),
        tx.pure.address(targetAddress),
      ],
    });

    return await this.client.signAndExecuteTransaction({
      signer: adminSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  /**
   * Removes an address from the validator-enforced DenyList.
   */
  async removeBlacklist(adminSigner: Ed25519Keypair, targetAddress: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn::remove_black_list`,
      arguments: [
        tx.object(this.config.coinStateId),
        tx.object(this.config.adminCapId),
        tx.object(this.config.denyListId),
        tx.pure.address(targetAddress),
      ],
    });

    return await this.client.signAndExecuteTransaction({
      signer: adminSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  // ==========================================
  // 5. Forwarders & Trusted Contracts (Object first, Cap second)
  // ==========================================

  async addForwarder(adminSigner: Ed25519Keypair, forwarderAddress: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::admin::add_can_forward`,
      arguments: [
        tx.object(this.config.adminRegistryId),
        tx.object(this.config.adminCapId),
        tx.pure.address(forwarderAddress),
      ],
    });
    return await this.client.signAndExecuteTransaction({ signer: adminSigner, transaction: tx });
  }

  async removeForwarder(adminSigner: Ed25519Keypair, forwarderAddress: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::admin::remove_can_forward`,
      arguments: [
        tx.object(this.config.adminRegistryId),
        tx.object(this.config.adminCapId),
        tx.pure.address(forwarderAddress),
      ],
    });
    return await this.client.signAndExecuteTransaction({ signer: adminSigner, transaction: tx });
  }

  async addTrustedContract(adminSigner: Ed25519Keypair, contractAddress: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::admin::add_trusted_contract`,
      arguments: [
        tx.object(this.config.adminRegistryId),
        tx.object(this.config.adminCapId),
        tx.pure.address(contractAddress),
      ],
    });
    return await this.client.signAndExecuteTransaction({ signer: adminSigner, transaction: tx });
  }

  async removeTrustedContract(adminSigner: Ed25519Keypair, contractAddress: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::admin::remove_trusted_contract`,
      arguments: [
        tx.object(this.config.adminRegistryId),
        tx.object(this.config.adminCapId),
        tx.pure.address(contractAddress),
      ],
    });
    return await this.client.signAndExecuteTransaction({ signer: adminSigner, transaction: tx });
  }

  // ==========================================
  // 6. State & Balance Queries
  // ==========================================

  async getCoinState() {
    return await this.client.getObject({
      id: this.config.coinStateId,
      options: { showContent: true },
    });
  }

  async getAdminRegistry() {
    return await this.client.getObject({
      id: this.config.adminRegistryId,
      options: { showContent: true },
    });
  }
}
