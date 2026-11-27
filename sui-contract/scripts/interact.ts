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
  pasCoinStateId?: string;
  pasCoinMetadataId?: string;
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
        tx.object(this.config.denyListId),
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
  // 5. Permissioned Asset Standard (PAS) Operations
  // ==========================================

  /**
   * Initializes the PAS Policy for cNGN on a shared Namespace.
   */
  async setupPasPolicy(adminSigner: Ed25519Keypair, namespaceId: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn::setup_pas_policy`,
      arguments: [
        tx.object(this.config.coinStateId),
        tx.object(this.config.adminCapId),
        tx.object(namespaceId),
      ],
    });
    return await this.client.signAndExecuteTransaction({
      signer: adminSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  /**
   * Mints tokens directly into a recipient's PAS Account.
   */
  async mintToAccount(minterSigner: Ed25519Keypair, toAccountId: string, amount: bigint) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn::mint_to_account`,
      arguments: [
        tx.object(this.config.coinStateId),
        tx.object(this.config.adminRegistryId),
        tx.object(this.config.denyListId),
        tx.object(toAccountId),
        tx.pure.u64(amount),
      ],
    });
    return await this.client.signAndExecuteTransaction({
      signer: minterSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  /**
   * Deposits a standard Coin<CNGN> into a PAS Account.
   */
  async depositCoinToAccount(userSigner: Ed25519Keypair, accountId: string, coinObjectId: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn::deposit_coin_to_account`,
      arguments: [
        tx.object(accountId),
        tx.object(coinObjectId),
      ],
    });
    return await this.client.signAndExecuteTransaction({
      signer: userSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  /**
   * Allows an account owner to self-burn their cNGN balance directly from their PAS Account.
   */
  async burnFromPasAccount(userSigner: Ed25519Keypair, policyId: string, accountId: string, amount: bigint) {
    const tx = new Transaction();
    const auth = tx.moveCall({
      target: 'pas::account::new_auth',
      arguments: [],
    });
    tx.moveCall({
      target: `${this.config.packageId}::cngn::burn_from_pas_account`,
      arguments: [
        tx.object(this.config.coinStateId),
        tx.object(this.config.denyListId),
        tx.object(policyId),
        tx.object(accountId),
        auth,
        tx.pure.u64(amount),
      ],
    });
    return await this.client.signAndExecuteTransaction({
      signer: userSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  /**
   * Admin claws back and burns cNGN from a blacklisted user's PAS account.
   */
  async destroyBlackFunds(adminSigner: Ed25519Keypair, policyId: string, fromAccountId: string, amount: bigint) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn::destroy_black_funds`,
      arguments: [
        tx.object(this.config.coinStateId),
        tx.object(this.config.adminCapId),
        tx.object(policyId),
        tx.object(fromAccountId),
        tx.object(this.config.denyListId),
        tx.pure.u64(amount),
      ],
    });
    return await this.client.signAndExecuteTransaction({
      signer: adminSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  // ==========================================
  // 6. Pure PAS Module Operations (cngn_pas)
  // ==========================================

  /**
   * Mints directly into an account using the pure cngn_pas module.
   */
  async mintToAccountPurePas(minterSigner: Ed25519Keypair, toAccountId: string, amount: bigint) {
    if (!this.config.pasCoinStateId) {
      throw new Error('pasCoinStateId not found in deployment config');
    }
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn_pas::mint_to_account`,
      arguments: [
        tx.object(this.config.pasCoinStateId),
        tx.object(this.config.adminRegistryId),
        tx.object(this.config.denyListId),
        tx.object(toAccountId),
        tx.pure.u64(amount),
      ],
    });
    return await this.client.signAndExecuteTransaction({
      signer: minterSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  /**
   * Self-burns directly from account using the pure cngn_pas module.
   */
  async burnFromPasAccountPurePas(userSigner: Ed25519Keypair, policyId: string, accountId: string, amount: bigint) {
    if (!this.config.pasCoinStateId) {
      throw new Error('pasCoinStateId not found in deployment config');
    }
    const tx = new Transaction();
    const auth = tx.moveCall({
      target: 'pas::account::new_auth',
      arguments: [],
    });
    tx.moveCall({
      target: `${this.config.packageId}::cngn_pas::burn_from_pas_account`,
      arguments: [
        tx.object(this.config.pasCoinStateId),
        tx.object(this.config.denyListId),
        tx.object(policyId),
        tx.object(accountId),
        auth,
        tx.pure.u64(amount),
      ],
    });
    return await this.client.signAndExecuteTransaction({
      signer: userSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  }

  /**
   * Regulatory clawback & burn using the pure cngn_pas module.
   */
  async destroyBlackFundsPurePas(adminSigner: Ed25519Keypair, policyId: string, fromAccountId: string, amount: bigint) {
    if (!this.config.pasCoinStateId) {
      throw new Error('pasCoinStateId not found in deployment config');
    }
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::cngn_pas::destroy_black_funds`,
      arguments: [
        tx.object(this.config.pasCoinStateId),
        tx.object(this.config.adminCapId),
        tx.object(policyId),
        tx.object(fromAccountId),
        tx.object(this.config.denyListId),
        tx.pure.u64(amount),
      ],
    });
    return await this.client.signAndExecuteTransaction({
      signer: adminSigner,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
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
