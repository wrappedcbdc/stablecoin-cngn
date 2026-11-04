# cNGN Token

A Cairo smart contract implementation of the cNGN token, a compliant ERC20 token.

## Key Features

- **Controlled Minting**: Pre-authorized minters with automatic authorization revocation after minting
- **Redemption Flow**: External whitelisted senders can transfer to internal users with auto-burn
- **Meta-Transaction Support**: Gasless transactions via Forwarder contract with SNIP-12 signing
- **Blacklist Management**: Prevent blacklisted addresses from interacting; owner can destroy their funds
- **Whitelist System**: Dual whitelist for external senders and internal users
- **Pausable Operations**: Emergency pause mechanism for all token operations
- **Trusted Forwarder**: Secure meta-transaction forwarding with nonce enforcement and replay protection

## Key Components

- **cngn.cairo**: Main token contract (V1) with ERC20, minting, burning, and redemption
- **cngn2.cairo**: Enhanced token contract (V2) with improved events and zero-address validation
- **forwarder.cairo**: Meta-transaction forwarder with SNIP-12 hashing and ISRC6 signature verification
- **Operations.cairo**: Admin contract (V1) managing minters, forwarders, blacklists, and whitelists
- **Operations2.cairo**: Admin contract (V2) with Pausable functionality for all admin functions
- **interface/IOperations.cairo**: Interface for administrative functions

```bash
scarb build
```

## Security Features

- Owner-controlled access for all administrative functions
- Blacklist protection preventing blacklisted addresses from any token interaction
- Sequential nonce enforcement and replay protection for meta-transactions
- ISRC6 signature verification for meta-transactions
- Emergency pause mechanism for all operations
- Zero-address validation in V2 contracts
- Automatic authorization revocation after minting

## Testing

Comprehensive test suite with 84 tests covering:
- Token deployment, ERC20 functions, and initialization
- Controlled minting, burning, and redemption flows
- Blacklist and whitelist management
- Admin operations and access control
- Pause/unpause functionality
- Meta-transaction forwarder verification
- Bridge authorization

```bash
scarb test
# or
snforge test
```

All 84 tests should pass across 5 test files: `test_cngn`, `test_cngn2`, `test_forwarder`, `test_operations`, `test_operations2`.

## Deployment

Deploy contracts to a local devnet, Starknet Sepolia (testnet), or Mainnet using TypeScript scripts or `sncast`.

### Prerequisites

- [Scarb](https://docs.swmansion.com/scarb/) — Cairo package manager and build tool
- [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/) (`snforge` + `sncast`) — testing and deployment CLI
- [starknet-devnet](https://github.com/0xSpaceShard/starknet-devnet) — local Starknet node (for local deployment)
- Node.js >= 18 and npm (for TypeScript deploy scripts)

### Install dependencies

```bash
npm install
```

---

### Local Devnet Deployment

#### 1. Install starknet-devnet

Download the pre-built binary for your platform from the [releases page](https://github.com/0xSpaceShard/starknet-devnet/releases) and place it on your PATH, or install via Cargo:

```bash
cargo install starknet-devnet
```

#### 2. Start the local devnet

```bash
starknet-devnet --host 127.0.0.1 --port 5050 --seed 42
```

Using `--seed 42` makes the pre-funded accounts deterministic — the same accounts are generated every time you restart with the same seed.

On startup, devnet prints 10 pre-deployed, pre-funded accounts:

```
| Account address |  0x034ba56f92265f0868c57d3fe72ecab144fc96f97954bbbc4252cef8e8a979ba
| Private key     |  0x00000000000000000000000000000000b137668388dbe9acdfa3bc734cc2c469
| Public key      |  0x05a5e37c60e77a0318643b111f88413a76af6233c891a0cfb2804106372006d4

Initial balance of each account: 1000000000000000000000 WEI and FRI
```

Each account has 1000 ETH and 1000 STRK pre-funded — no faucet needed.

#### 3. Create `accounts.json`

Create an `accounts.json` file using one of the printed accounts:

```json
{
  "alpha-sepolia": {
    "devnet-account": {
      "address": "0x034ba56f92265f0868c57d3fe72ecab144fc96f97954bbbc4252cef8e8a979ba",
      "class_hash": "0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564",
      "deployed": true,
      "legacy": false,
      "private_key": "0x00000000000000000000000000000000b137668388dbe9acdfa3bc734cc2c469",
      "public_key": "0x05a5e37c60e77a0318643b111f88413a76af6233c891a0cfb2804106372006d4",
      "type": "open_zeppelin"
    }
  }
}
```

The `class_hash` comes from the devnet startup line:
```
Predeployed accounts using class Custom with hash: 0x05b4b537eaa2...
```

> **Note:** These keys are only valid on your local devnet. Never use them on Sepolia or Mainnet.

#### 4. Build contracts (with CASM output enabled)

Ensure `Scarb.toml` has `casm = true` under `[[target.starknet-contract]]`:

```toml
[[target.starknet-contract]]
sierra = true
casm = true
```

Then build:

```bash
scarb build
```

#### 5. Declare and deploy with the Makefile

```bash
# Declare all 5 contracts (builds first)
make declare-all

# Deploy in dependency order — copy class hashes from declare output
make deploy-all \
  OWNER=<owner_address> \
  OPS_CLASS=<hash>  OPS2_CLASS=<hash>  FWD_CLASS=<hash> \
  CNGN_CLASS=<hash> CNGN2_CLASS=<hash>
```

This writes 5 address cache files (`.ops_address`, `.ops2_address`, etc.) used by all subsequent `make` targets.

#### Deployment order matters

The contracts have dependencies and must be deployed in this order:

```
Operations  ──────────────────────────────────────────► Cngn
Operations2 ──► Forwarder ──► Cngn
                           └──► Cngn2
```

| Contract | Constructor args |
|---|---|
| `Operations` | `owner` |
| `Operations2` | `owner` |
| `Forwarder` | `operations2_address, owner` |
| `Cngn` | `forwarder_address, operations_address, owner` |
| `Cngn2` | `forwarder_address, operations2_address, owner` |

#### 6. Post-deployment setup (required before first mint)

After deployment, register Cngn2 as a **trusted contract** in Operations2. This is required because `mint()` calls back into Operations2 to clear the minter's authorization after each mint.

```bash
make add-trusted ADDR=$(cat .cngn2_address)
```

Without this step, every `mint` call will revert with `Not authorized`.

#### Verify a deployment

```bash
make token-name      # Response: "cNGN"
make total-supply    # Response: 0_u256
make can-mint ADDR=<owner_address>   # Response: true
```

---

### Contract Interactions (Makefile)

All write operations use `sncast` via the Makefile. Run `make help` to see all targets.

#### Minting (Operations2 + Cngn2)

The minting design is **single-use authorization**: the owner sets a one-time mint amount for a minter; calling `mint()` consumes and clears that authorization.

```bash
# Step 1 — authorize the minter (owner only)
make add-minter ADDR=<minter_address>

# Step 2 — set the exact amount they may mint (owner only)
make set-mint-amount ADDR=<minter_address> AMOUNT=1000000   # 1 cNGN (6 decimals)

# Step 3 — minter calls mint (must be the authorized minter)
make mint AMOUNT=1000000 RECIPIENT=<recipient_address>

# One-shot shortcut (owner authorizes + mints in one make call)
make mint-full AMOUNT=1000000 RECIPIENT=<recipient_address>
```

> After each successful `mint`, the minter's `can_mint` and `mint_amount` are cleared. To mint again, repeat steps 1–2.

#### Token operations (Cngn2)

```bash
make transfer  RECIPIENT=<address> AMOUNT=1000000
make approve   SPENDER=<address>   AMOUNT=1000000
make burn      AMOUNT=500000
make balance   ADDR=<address>
make total-supply
make allowance OWNER=<address> SPENDER=<address>
```

#### Admin operations (Operations2)

```bash
make add-minter          ADDR=<address>
make remove-minter       ADDR=<address>
make set-mint-amount     ADDR=<address> AMOUNT=<u256>
make remove-mint-amount  ADDR=<address>
make add-forwarder       ADDR=<address>
make remove-forwarder    ADDR=<address>
make add-trusted         ADDR=<address>
make blacklist           ADDR=<address>
make unblacklist         ADDR=<address>
make whitelist-internal  ADDR=<address>
make whitelist-external  ADDR=<address>
make pause-ops2
make unpause-ops2
```

#### Forwarder

```bash
make authorize-bridge    ADDR=<bridge_address>
make deauthorize-bridge  ADDR=<bridge_address>
make is-authorized       ADDR=<bridge_address>
make get-nonce           ADDR=<address>
make pause-forwarder
make unpause-forwarder
```

---

### Sepolia / Mainnet Deployment

Configure your `.env` file:

```bash
cp env.example .env
```

```env
STARKNET_PRIVATE_KEY=your_private_key
STARKNET_ACCOUNT_ADDRESS=0x_your_account_address
STARKNET_NETWORK=sepolia
CONTRACT_OWNER_ADDRESS=0x_owner_address
```

```bash
# Deploy to Sepolia testnet
npm run deploy:sepolia

# Deploy to Mainnet
npm run deploy:mainnet
```

Deployment addresses are saved to the `deployments/` folder.

