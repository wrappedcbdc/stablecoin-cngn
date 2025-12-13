### cngn-solana
Welcome to the cngn-solana project! This project is designed to help you get started with Solana development.

**Getting Started**
To get started with this project, follow these steps:

Clone the Repository:

```sh
git clone <Update this to convertity>
```
Navigate to the Project Directory:

```sh
cd cngn
```
Install Dependencies:

```sh
npm install
```
- Usage
To build the project, run the following command:

```sh
anchor build
```

To deploy the project, run the following command:

edit this section of the anchor.toml file

[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"


**Export Wallet**
```sh
export ANCHOR_WALLET=~/.config/solana/id.json
```

update the cluster, for devnet change "Localnet" to "Devnet", for mainnet change to "Mainnet"

```sh
anchor deploy
```


**Solana Configuration**
- Set Solana Config
You can set your Solana configuration to different clusters using the following commands:

```sh
solana config set --url mainnet-beta
solana config set --url devnet
solana config set --url localhost
solana config set --url testnet
```
- Create a Wallet
To create a new wallet:

```sh
solana-keygen new
```
- To view your wallet's address:

```sh
solana address
```
- Request an Airdrop
Request an airdrop of SOL to your wallet to pay for transactions and program deployments:

Set your cluster to the devnet:
```sh
solana config set --url devnet
```
Request an airdrop of devnet SOL:

```sh
solana airdrop 2
```
Check your wallet's SOL balance:

```sh
solana balance
```
- Run a Local Validator
The Solana CLI includes a built-in test validator for local development.

Start a local validator:

```sh
solana-test-validator
```
Update your CLI to use localhost before running any commands:

```sh
solana config set --url localhost
```
Test Your Program
To test your project, run the following command:

```sh
 anchor test
 ```

#### Architecture Overview
The architecture consists of three main components:

**CONTROL**: Manages permissions and constraints (whitelist, blacklist, etc.).
TOKEN: Handles core token operations (mint, burn, transfer, etc.).
FORWARDER: Provides a signature verification and execution layer.
On the admin side:

**MULTI-SIG WALLET / Owner**: Requires multiple approvals (3/3 threshold) for administrative actions.
Implementation with PDAs
In this system, you would likely need multiple PDAs to implement this architecture:

- Control PDAs:

Whitelist PDA: Stores addresses allowed to interact with the token.
Blacklist PDA: Stores addresses banned from using the token.
Permission PDAs: Store settings for CanMint, MintAmount, and CanForward flags.

- Token Authority PDAs:

Mint Authority PDA: Controls token minting.
Freeze Authority PDA: Can freeze token accounts.
Program Authority PDA: For general program operations.
Admin PDAs:

Multi-sig State PDA: Tracks signatures toward the 3/3 threshold.
Admin Config PDA: Stores admin settings and permissions.

**Flow Explanation**
Forwarder -> Token:

A user submits a transaction to the Forwarder program.
The Forwarder verifies the signature and executes the requested token operation.
This provides a layer of abstraction/indirection for token operations.

Token -> Control:
Before executing token operations, the Token program checks permissions with Control.
It verifies the user is whitelisted, not blacklisted, and has appropriate permissions.

Control -> Token:
The Control program provides approval/rejection to the Token program.
This might include limits on mint amounts or transfer restrictions.
Admin Flow:

Administrative actions require 3/3 multi-sig approval.
Approved admin actions can modify both Token and Control settings.

Implementation Approach

Token, Control, and Forwarder.

All control state are stored in PDAs referenced by the token program.
For multi-sig, implement a proposal and signing system using PDAs.
For example, when someone wants to mint tokens:

They call the Forwarder with their request.
The Forwarder verifies their signature and calls the Token program.
The Token program calls Control to check permissions.
If approved, the Token program uses its PDA authority to mint tokens.
Benefits
Separation of concerns (token logic vs. access control).
Flexibility (can update control rules without changing token logic).
Security (multi-sig for admin operations).
Compliance (whitelist/blacklist support).
Additional Commands



### Contributing
We welcome contributions! Please read our contributing guidelines for more information.

### License
This project is licensed under the MIT License. See the LICENSE file for details.

### Contact
If you have any questions, feel free to open an issue or contact the project maintainers.



