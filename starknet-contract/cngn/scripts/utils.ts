import { Account, RpcProvider, Contract, json, Signer } from "starknet";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

export const NETWORKS = {
  local: { rpcUrl: process.env.LOCAL_RPC_URL || "http://127.0.0.1:5050/rpc" },
  sepolia: { rpcUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_7" },
  mainnet: { rpcUrl: "https://starknet-mainnet.public.blastapi.io/rpc/v0_7" },
};

export type Network = keyof typeof NETWORKS;

export function log(message: string, _color?: string) {
  console.log(message);
}

export function getProvider(network: Network): RpcProvider {
  const blockIdentifier = network === "local" ? "latest" : "pending";
  return new RpcProvider({ nodeUrl: NETWORKS[network].rpcUrl, blockIdentifier });
}

export function getAccount(provider: RpcProvider): Account {
  const privateKey = process.env.STARKNET_PRIVATE_KEY;
  const accountAddress = process.env.STARKNET_ACCOUNT_ADDRESS;
  if (!privateKey || !accountAddress) {
    console.error("Error: Missing STARKNET_PRIVATE_KEY or STARKNET_ACCOUNT_ADDRESS in .env");
    process.exit(1);
  }
  return new Account(provider, accountAddress, privateKey);
}

/**
 * Returns an Account connected to a multisig address.
 *
 * Signer keys are read from environment variables in order:
 *   SIGNER_1_KEY, SIGNER_2_KEY, SIGNER_3_KEY, ...
 *
 * The account address comes from MULTISIG_ADDRESS (falls back to
 * STARKNET_ACCOUNT_ADDRESS when only a single signer is configured).
 *
 * Single signer  → behaves identically to getAccount()
 * Multiple signers → starknet.js passes all signatures to the on-chain
 *                    multisig account contract (Argent multisig / Safe)
 *
 * Example .env for a 2-of-2 Argent multisig:
 *   MULTISIG_ADDRESS=0x04ab...
 *   SIGNER_1_KEY=0x01...
 *   SIGNER_2_KEY=0x02...
 */
export function getMultisigAccount(provider: RpcProvider): Account {
  const signerKeys: string[] = [];
  for (let i = 1; ; i++) {
    const key = process.env[`SIGNER_${i}_KEY`];
    if (!key) break;
    signerKeys.push(key);
  }

  if (signerKeys.length === 0) {
    // Fall back to single-key account
    return getAccount(provider);
  }

  const address = process.env.MULTISIG_ADDRESS || process.env.STARKNET_ACCOUNT_ADDRESS;
  if (!address) {
    console.error("Error: Missing MULTISIG_ADDRESS or STARKNET_ACCOUNT_ADDRESS in .env");
    process.exit(1);
  }

  if (signerKeys.length === 1) {
    return new Account(provider, address, signerKeys[0]);
  }

  const signers = signerKeys.map((k) => new Signer(k));
  return new Account(provider, address, signers as any);
}

export function getNetwork(): Network {
  const n = (process.env.STARKNET_NETWORK || process.env.NETWORK || "local") as Network;
  if (!NETWORKS[n]) {
    console.error(`Error: Invalid network '${n}'. Use 'local', 'sepolia', or 'mainnet'`);
    process.exit(1);
  }
  return n;
}

export function loadDeployment(network: Network): Record<string, { classHash: string; address: string }> {
  const file = path.join(process.cwd(), "deployments", `${network}_latest.json`);
  if (!fs.existsSync(file)) {
    console.error(`No deployment found for network '${network}'. Run deploy.ts first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, "utf-8")).contracts;
}

export function loadAbi(contractName: string): any {
  const sierraPath = path.join(process.cwd(), "target", "dev", `cngn_${contractName}.contract_class.json`);
  if (!fs.existsSync(sierraPath)) {
    console.error(`ABI not found for ${contractName}. Run 'scarb build' first.`);
    process.exit(1);
  }
  return json.parse(fs.readFileSync(sierraPath, "utf-8")).abi;
}
