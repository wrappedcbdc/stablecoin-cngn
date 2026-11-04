import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// --- Paths & Config ---
const ROOT_DIR = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'deployment.json');
const ENV_PATH = path.join(ROOT_DIR, '.env');

interface DeploymentConfig {
  packageId: string;
  upgradeCapId: string;
  adminCapId: string;
  adminRegistryId: string;
  coinStateId: string;
  coinMetadataId: string;
  denyListId: string;
  packageHistory?: string[];
}

/**
 * Upgrades the cNGN Move package using the UpgradeCap.
 * 
 * Process:
 * 1. Builds the Move package and produces compiled modules + digest.
 * 2. Creates a Transaction Block with `UpgradeCap`.
 * 3. Signs and executes the upgrade transaction on Sui network.
 * 4. Extracts the new Package ID from the transaction effects.
 * 5. Updates `deployment.json` and `.env` with the new Package ID while preserving UpgradeCap and shared objects.
 */
export async function upgradePackage(
  adminKeypair: Ed25519Keypair,
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet' = 'testnet'
): Promise<string> {
  console.log(`\n=== Upgrading cNGN Package on ${network} ===`);

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Deployment config not found at ${CONFIG_PATH}. Run deploy script first.`);
  }

  const config: DeploymentConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const client = new SuiClient({ url: getFullnodeUrl(network) });

  console.log(`Current Package ID:   ${config.packageId}`);
  console.log(`Using UpgradeCap ID:  ${config.upgradeCapId}`);

  // Step 1: Build Move package and get compiled modules and digest via sui CLI
  console.log('\n[1/4] Building Move package and extracting build output...');
  const buildOutput = execSync('sui move build --dump-bytecode-as-base64', {
    cwd: ROOT_DIR,
    encoding: 'utf-8',
  });

  const parsedBuild = JSON.parse(buildOutput);
  const modules: string[] = parsedBuild.modules;
  const dependencies: string[] = parsedBuild.dependencies;
  const digest: number[] = parsedBuild.digest;

  console.log(`Compiled ${modules.length} module(s) with digest.`);

  // Step 2: Construct the upgrade transaction block
  console.log('\n[2/4] Constructing Upgrade Transaction Block...');
  const tx = new Transaction();
  tx.setGasBudget(150_000_000n); // 0.15 SUI

  // Authorize upgrade -> returns an UpgradeTicket
  const ticket = tx.moveCall({
    target: '0x2::package::authorize_upgrade',
    arguments: [
      tx.object(config.upgradeCapId),
      tx.pure.u8(0), // UpgradePolicy: 0 = COMPATIBLE
      tx.pure.vector('u8', digest),
    ],
  });

  // Upgrade transaction command
  const receipt = tx.upgrade({
    modules,
    dependencies,
    package: config.packageId,
    ticket,
  });

  // Commit upgrade -> consumes receipt and updates UpgradeCap version
  tx.moveCall({
    target: '0x2::package::commit_upgrade',
    arguments: [
      tx.object(config.upgradeCapId),
      receipt,
    ],
  });

  // Step 3: Sign & Execute Transaction
  console.log('\n[3/4] Submitting upgrade transaction to network...');
  const result = await client.signAndExecuteTransaction({
    signer: adminKeypair,
    transaction: tx,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });

  if (result.effects?.status.status !== 'success') {
    throw new Error(`Upgrade transaction failed: ${result.effects?.status.error}`);
  }

  // Step 4: Extract new Package ID
  const publishedChange = result.objectChanges?.find(
    (change) => change.type === 'published'
  );

  if (!publishedChange || publishedChange.type !== 'published') {
    throw new Error('Could not find published package in transaction effects');
  }

  const newPackageId = publishedChange.packageId;
  console.log(`\n✓ Package successfully upgraded!`);
  console.log(`New Package ID: ${newPackageId}`);

  // Update deployment.json
  const previousPackageId = config.packageId;
  config.packageId = newPackageId;
  config.packageHistory = config.packageHistory || [];
  config.packageHistory.push(previousPackageId);

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

  // Update .env
  if (fs.existsSync(ENV_PATH)) {
    let envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    envContent = envContent.replace(
      /SUI_PACKAGE_ID=.*/,
      `SUI_PACKAGE_ID=${newPackageId}`
    );
    fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
  }

  console.log('[4/4] Updated deployment.json and .env with the new Package ID.');
  return newPackageId;
}

// CLI runner if executed directly
if (require.main === module) {
  const privateKey = process.env.SUI_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: SUI_ADMIN_PRIVATE_KEY environment variable is required.');
    process.exit(1);
  }

  const adminKeypair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
  upgradePackage(adminKeypair, (process.env.SUI_NETWORK as any) || 'testnet')
    .then((pkgId) => {
      console.log(`Upgrade complete: ${pkgId}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Upgrade failed:', err);
      process.exit(1);
    });
}
