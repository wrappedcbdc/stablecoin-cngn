# cngn-solana
This project template helps developers get started with Solana development.

**Getting Started**
To set up the development environment:

Clone the repository:

```sh
git clone <Update this to convertity>
```
Navigate to the project:

```sh
cd cngn
```
- Install dependencies:

```sh
npm install
```
-Usage
Build the project:

```sh
anchor build
```
- Deploy the project:

Modify anchor.toml:

toml
[provider]
cluster = "Localnet"  # Use "Devnet" or "Mainnet"
wallet = "~/.config/solana/id.json"
Deploy:

```sh
anchor deploy
```
***Solana Configuration***
Manage Solana configuration with these commands:

- Switch networks
```sh
solana config set --url mainnet-beta
solana config set --url devnet
solana config set --url localhost
solana config set --url testnet
```
- Create wallet
```sh
solana-keygen new
```

- View address
```sh
solana address
```

- Request devnet SOL
```sh
solana airdrop 2
```

- Check balance
```sh
solana balance
```

- Start local validator
```sh
solana-test-validator
```
**Testing**
Run tests using:

```sh
anchor test
```
***Architecture Overview***
- The system comprises three components:

CONTROL - Manages permissions (whitelists/blacklists)

TOKEN - Handles core token operations

FORWARDER - Executes verified transactions

- Implementation Details

PDAs store state:

Control PDAs for permissions

Authority PDAs for token operations

Multi-sig PDAs for admin approvals

- Transaction workflow:

Forwarder validates requests

Token checks Control permissions

Executes approved actions

- Admin Controls
Requires 3/3 multi-sig approval for:

Token parameter changes

Permission list updates

Program authority modifications

- Wallet Setup
Export wallet path:

```sh
export ANCHOR_WALLET=~/.config/solana/id.json
```
### Contributing
Contributions are welcome. Check project issues for current needs.

### License
MIT License - see LICENSE file.

### Contact
Open GitHub issues for support or questions.