import {
  Account,
  RpcProvider,
  Contract,
  json,
  CallData,
  stark,
  hash,
} from "starknet";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// Network configurations
const NETWORKS = {
  local: {
    rpcUrl: process.env.LOCAL_RPC_URL || "http://127.0.0.1:5050/rpc",
    explorerUrl: "",
  },
  sepolia: {
    rpcUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_7",
    explorerUrl: "https://sepolia.starkscan.co",
  },
  mainnet: {
    rpcUrl: "https://starknet-mainnet.public.blastapi.io/rpc/v0_7",
    explorerUrl: "https://starkscan.co",
  },
};

const CONTRACTS = [
  "Operations",
  "Operations2",
  "Cngn",
  "Cngn2",
  "Forwarder",
] as const;

type ContractName = (typeof CONTRACTS)[number];

interface DeployedContract {
  classHash: string;
  address: string;
}

interface DeploymentResult {
  network: string;
  timestamp: string;
  owner: string;
  contracts: Record<ContractName, DeployedContract>;
}

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadCompiledContract(contractName: string): {
  sierra: any;
  casm: any;
} {
  const basePath = path.join(process.cwd(), "target", "dev");

  const sierraPath = path.join(basePath, `cngn_${contractName}.contract_class.json`);
  const casmPath = path.join(basePath, `cngn_${contractName}.compiled_contract_class.json`);

  if (!fs.existsSync(sierraPath)) {
    throw new Error(
      `Sierra file not found: ${sierraPath}\nRun 'scarb build' first.`
    );
  }

  if (!fs.existsSync(casmPath)) {
    throw new Error(
      `CASM file not found: ${casmPath}\nRun 'scarb build' first.`
    );
  }

  const sierra = json.parse(fs.readFileSync(sierraPath, "utf-8"));
  const casm = json.parse(fs.readFileSync(casmPath, "utf-8"));

  return { sierra, casm };
}

async function declareContract(
  account: Account,
  contractName: string
): Promise<string> {
  log(`\nDeclaring ${contractName}...`, "blue");

  const { sierra, casm } = loadCompiledContract(contractName);

  try {
    const declareResponse = await account.declare({
      contract: sierra,
      casm: casm,
    });

    log(`  Transaction hash: ${declareResponse.transaction_hash}`, "cyan");
    log(`  Waiting for confirmation...`, "yellow");

    await account.waitForTransaction(declareResponse.transaction_hash);

    log(`  Class hash: ${declareResponse.class_hash}`, "green");
    return declareResponse.class_hash;
  } catch (error: any) {
    // Check if already declared
    if (error.message?.includes("already declared") || error.message?.includes("StarknetErrorCode.CLASS_ALREADY_DECLARED")) {
      const classHash = hash.computeContractClassHash(sierra);
      log(`  Already declared. Class hash: ${classHash}`, "yellow");
      return classHash;
    }
    throw error;
  }
}

async function deployContract(
  account: Account,
  classHash: string,
  constructorArgs: any[],
  contractName: string
): Promise<string> {
  log(`\nDeploying ${contractName}...`, "blue");

  const deployResponse = await account.deployContract({
    classHash: classHash,
    constructorCalldata: constructorArgs,
  });

  log(`  Transaction hash: ${deployResponse.transaction_hash}`, "cyan");
  log(`  Waiting for confirmation...`, "yellow");

  await account.waitForTransaction(deployResponse.transaction_hash);

  log(`  Contract address: ${deployResponse.contract_address}`, "green");
  return deployResponse.contract_address;
}

async function main() {
  const network = (process.env.STARKNET_NETWORK || process.env.NETWORK || "sepolia") as keyof typeof NETWORKS;
  const privateKey = process.env.STARKNET_PRIVATE_KEY;
  const accountAddress = process.env.STARKNET_ACCOUNT_ADDRESS;
  const ownerAddress = process.env.CONTRACT_OWNER_ADDRESS || accountAddress;

  if (!privateKey || !accountAddress) {
    log("Error: Missing STARKNET_PRIVATE_KEY or STARKNET_ACCOUNT_ADDRESS", "red");
    log("Please set these in your .env file", "yellow");
    process.exit(1);
  }

  if (!NETWORKS[network]) {
    log(`Error: Invalid network '${network}'. Use 'local', 'sepolia', or 'mainnet'`, "red");
    process.exit(1);
  }

  const networkConfig = NETWORKS[network];

  log("========================================", "blue");
  log("   cNGN Contracts Deployment", "blue");
  log("========================================", "blue");
  log(`Network: ${network}`, "yellow");
  log(`Owner: ${ownerAddress}`, "yellow");
  log(`RPC: ${networkConfig.rpcUrl}`, "cyan");

  // Mainnet confirmation
  if (network === "mainnet") {
    log("\n⚠️  WARNING: You are deploying to MAINNET!", "red");
    log("This will cost real funds and cannot be undone.", "red");

    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question("Type 'yes' to continue: ", resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== "yes") {
      log("Deployment cancelled.", "yellow");
      process.exit(0);
    }
  }

  // For local devnet (spec 0.8+), 'pending' is replaced by 'pre_confirmed'; use 'latest' to avoid issues
  const blockIdentifier = network === "local" ? "latest" : "pending";
  const provider = new RpcProvider({ nodeUrl: networkConfig.rpcUrl, blockIdentifier });
  const account = new Account(provider, accountAddress, privateKey);

  log("\nChecking account...", "yellow");
  try {
    // Use 'latest' block for local devnet (spec 0.8+ uses 'pre_confirmed' instead of 'pending')
    const blockId = network === "local" ? "latest" : "pending";
    const accountNonce = await provider.getNonceForAddress(accountAddress, blockId);
    log(`Account nonce: ${accountNonce}`, "green");
  } catch (error) {
    log("Error: Could not connect to account. Check your credentials.", "red");
    process.exit(1);
  }

  log("\nBuilding contracts...", "yellow");
  const { execSync } = await import("child_process");
  try {
    execSync("scarb build", { stdio: "inherit" });
    log("Build successful!", "green");
  } catch (error) {
    log("Build failed. Please fix compilation errors.", "red");
    process.exit(1);
  }

  const classHashes: Record<string, string> = {};
  const addresses: Record<string, string> = {};

  log("\n========================================", "blue");
  log("   Declaring Contracts", "blue");
  log("========================================", "blue");

  for (const contractName of CONTRACTS) {
    classHashes[contractName] = await declareContract(account, contractName);
  }

  log("\n========================================", "blue");
  log("   Deploying Contracts", "blue");
  log("========================================", "blue");

  addresses.Operations = await deployContract(
    account,
    classHashes.Operations,
    [ownerAddress],
    "Operations"
  );

  addresses.Operations2 = await deployContract(
    account,
    classHashes.Operations2,
    [ownerAddress],
    "Operations2"
  );

  addresses.Forwarder = await deployContract(
    account,
    classHashes.Forwarder,
    [addresses.Operations2, ownerAddress],
    "Forwarder"
  );

  addresses.Cngn = await deployContract(
    account,
    classHashes.Cngn,
    [addresses.Forwarder, addresses.Operations, ownerAddress],
    "Cngn"
  );

  addresses.Cngn2 = await deployContract(
    account,
    classHashes.Cngn2,
    [addresses.Forwarder, addresses.Operations2, ownerAddress],
    "Cngn2"
  );

  const deploymentResult: DeploymentResult = {
    network,
    timestamp: new Date().toISOString(),
    owner: ownerAddress!,
    contracts: {
      Operations: { classHash: classHashes.Operations, address: addresses.Operations },
      Operations2: { classHash: classHashes.Operations2, address: addresses.Operations2 },
      Cngn: { classHash: classHashes.Cngn, address: addresses.Cngn },
      Cngn2: { classHash: classHashes.Cngn2, address: addresses.Cngn2 },
      Forwarder: { classHash: classHashes.Forwarder, address: addresses.Forwarder },
    },
  };

  const deploymentsDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const deploymentFile = path.join(deploymentsDir, `${network}_${timestamp}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentResult, null, 2));

  const latestFile = path.join(deploymentsDir, `${network}_latest.json`);
  fs.writeFileSync(latestFile, JSON.stringify(deploymentResult, null, 2));

  log("\n========================================", "blue");
  log("   Deployment Complete! 🎉", "green");
  log("========================================", "blue");
  log(`\nDeployment saved to: ${deploymentFile}`, "yellow");

  log("\nContract Addresses:", "blue");
  log(`  Operations:  ${addresses.Operations}`, "green");
  log(`  Operations2: ${addresses.Operations2}`, "green");
  log(`  Cngn:        ${addresses.Cngn}`, "green");
  log(`  Cngn2:       ${addresses.Cngn2}`, "green");
  log(`  Forwarder:   ${addresses.Forwarder}`, "green");

  if (networkConfig.explorerUrl) {
    log("\nView on StarkScan:", "blue");
    for (const [name, address] of Object.entries(addresses)) {
      log(`  ${name}: ${networkConfig.explorerUrl}/contract/${address}`, "cyan");
    }
  }
}

main().catch((error) => {
  log(`\nError: ${error.message}`, "red");
  console.error(error);
  process.exit(1);
});

