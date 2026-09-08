## cNGN Foundry contract for EVM

**cNGN** stands apart as the first regulated stablecoin in Africa. As a fully compliant digital asset, cNGN offers unparalleled trust and transparency, ensuring security for all users, institutions, and businesses.

cNGN, fosters the expansion of fintechs, liquidity providers, and virtual asset entities in Nigeria's digital economy. This initiative is bolstered by regulatory approval under the SEC's Regulatory Incubation (RI) Program, significantly contributing to the growth of Nigeria's digital asset ecosystem.

# Install dependencies
```bash
# Install OpenZeppelin contracts
forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v4.8.0-rc.1
forge install OpenZeppelin/openzeppelin-contracts@v4.9.6
```

# File Structure
files in this codebase is in the following structure:

project/
├── foundry.toml
├── script/
├── src/
│   ├── Cngn.sol
│   ├── Cngn2.sol
│   ├── Cngn3.sol
│   ├── Forwarder.sol
│   ├── IOperations.sol
│   ├── Operations.sol
│   └── Operations2.sol
└── test/
    ├── Cngn.t.sol
    ├── Admin.t.sol
    ├── Forwarder.t.sol
    └── Integration.t.sol

## Usage

### Build

```shell
$ forge build
```

## Test

### Run all tests
```bash
forge test
```

### Run with verbosity to see details
```bash
forge test -vv
```
### Run with gas reporting
```bash
forge test --gas-report
```

### Run specific test file
```bash
forge test --match-path test/Cngn.t.sol
forge test --match-path test/Admin.t.sol
forge test --match-path test/Forwarder.t.sol
forge test --match-path test/Integration.t.sol
```

### Run specific test function
```bash
forge test --match-test test_Mint
```

### Run with coverage
```bash
forge coverage
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```
