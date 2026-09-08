# =============================================================================
# cNGN Starknet Contract — Makefile
# =============================================================================
# All write operations use sncast (Starknet Foundry) which is fully compatible
# with starknet-devnet v0.7.x and supports V3 transactions natively.
# Read operations use sncast call.
#
# Profiles are defined in snfoundry.toml:
#   local   → http://127.0.0.1:5050  (devnet)
#   sepolia → Starknet Sepolia testnet
#   mainnet → Starknet Mainnet
#
# Usage: make <target> [NETWORK=local|sepolia|mainnet] [ARGS...]
# =============================================================================

NETWORK     ?= local
ACCOUNTS_FILE = ./accounts.json
ACCOUNT       = devnet-account
BUILD_DIR     = target/dev
SEED          = 42

# Load deployed addresses from sncast output cache files (created by make deploy-all)
OPS_ADDR      ?= $(shell cat .ops_address 2>/dev/null)
OPS2_ADDR     ?= $(shell cat .ops2_address 2>/dev/null)
FWD_ADDR      ?= $(shell cat .fwd_address 2>/dev/null)
CNGN_ADDR     ?= $(shell cat .cngn_address 2>/dev/null)
CNGN2_ADDR    ?= $(shell cat .cngn2_address 2>/dev/null)

# sncast shorthand using profile (snfoundry.toml profile = NETWORK value)
SNCAST = sncast -p $(NETWORK)

# sncast shorthand using explicit accounts file (for local devnet only)
SNCAST_LOCAL = sncast --accounts-file $(ACCOUNTS_FILE) --account $(ACCOUNT)

.PHONY: help
help:
	@echo ""
	@echo "============================================================"
	@echo "  cNGN Contract — Make targets"
	@echo "============================================================"
	@echo ""
	@echo "  SETUP"
	@echo "    make devnet              Start local starknet-devnet (seed=$(SEED))"
	@echo "    make build               scarb build (sierra + casm)"
	@echo "    make test                Run all 84 snforge tests"
	@echo ""
	@echo "  DEPLOYMENT (local devnet)"
	@echo "    make declare-all         Declare all 5 contracts"
	@echo "    make deploy-all          Deploy all 5 contracts in correct order"
	@echo "    make deploy-local        declare-all + deploy-all"
	@echo ""
	@echo "  OPERATIONS2 — admin/minter management (owner-only)"
	@echo "    make add-minter          ADDR=<address>"
	@echo "    make remove-minter       ADDR=<address>"
	@echo "    make set-mint-amount     ADDR=<address> AMOUNT=<u256>"
	@echo "    make remove-mint-amount  ADDR=<address>"
	@echo "    make add-forwarder       ADDR=<address>"
	@echo "    make remove-forwarder    ADDR=<address>"
	@echo "    make add-trusted         ADDR=<address>"
	@echo "    make blacklist           ADDR=<address>"
	@echo "    make unblacklist         ADDR=<address>"
	@echo "    make whitelist-internal  ADDR=<address>"
	@echo "    make whitelist-external  ADDR=<address>"
	@echo "    make pause-ops2"
	@echo "    make unpause-ops2"
	@echo ""
	@echo "  OPERATIONS2 — read"
	@echo "    make can-mint            ADDR=<address>"
	@echo "    make can-forward         ADDR=<address>"
	@echo "    make mint-amount         ADDR=<address>"
	@echo "    make is-blacklisted      ADDR=<address>"
	@echo ""
	@echo "  CNGN2 — token operations"
	@echo "    make mint                AMOUNT=<u256> RECIPIENT=<address>"
	@echo "    make mint-full           AMOUNT=<u256> RECIPIENT=<address>  (auth+mint in one)"
	@echo "    make transfer            RECIPIENT=<address> AMOUNT=<u256>"
	@echo "    make approve             SPENDER=<address> AMOUNT=<u256>"
	@echo "    make burn                AMOUNT=<u256>"
	@echo "    make destroy-funds       ADDR=<address>"
	@echo "    make pause-cngn2"
	@echo "    make unpause-cngn2"
	@echo ""
	@echo "  CNGN2 — read"
	@echo "    make balance             ADDR=<address>"
	@echo "    make total-supply"
	@echo "    make allowance           OWNER=<address> SPENDER=<address>"
	@echo "    make token-name"
	@echo "    make token-symbol"
	@echo "    make token-decimals"
	@echo ""
	@echo "  FORWARDER"
	@echo "    make authorize-bridge    ADDR=<address>"
	@echo "    make deauthorize-bridge  ADDR=<address>"
	@echo "    make is-authorized       ADDR=<address>"
	@echo "    make get-nonce           ADDR=<address>"
	@echo "    make pause-forwarder"
	@echo "    make unpause-forwarder"
	@echo ""
	@echo "  CLEANUP"
	@echo "    make clean               Remove build artifacts"
	@echo "    make clean-all           Remove build + deployment cache"
	@echo ""
	@echo "  NETWORK=$(NETWORK)  (override with NETWORK=sepolia|mainnet)"
	@echo ""

# =============================================================================
# SETUP
# =============================================================================

.PHONY: devnet
devnet:
	@echo "Starting starknet-devnet on 127.0.0.1:5050 (seed=$(SEED))..."
	starknet-devnet --host 127.0.0.1 --port 5050 --seed $(SEED)

.PHONY: build
build:
	scarb build

.PHONY: test
test:
	scarb test

# =============================================================================
# DEPLOYMENT — local devnet
# Uses sncast with explicit accounts file (snfoundry.toml local profile
# points to port 5050 without /rpc; sncast adds it automatically)
# =============================================================================

.PHONY: declare-all
declare-all: build
	@echo "=== Declaring Operations ==="
	$(SNCAST_LOCAL) declare --url http://127.0.0.1:5050/rpc --contract-name Operations 2>&1 | tee /tmp/declare_ops.txt
	@echo ""
	@echo "=== Declaring Operations2 ==="
	$(SNCAST_LOCAL) declare --url http://127.0.0.1:5050/rpc --contract-name Operations2 2>&1 | tee /tmp/declare_ops2.txt
	@echo ""
	@echo "=== Declaring Forwarder ==="
	$(SNCAST_LOCAL) declare --url http://127.0.0.1:5050/rpc --contract-name Forwarder 2>&1 | tee /tmp/declare_fwd.txt
	@echo ""
	@echo "=== Declaring Cngn ==="
	$(SNCAST_LOCAL) declare --url http://127.0.0.1:5050/rpc --contract-name Cngn 2>&1 | tee /tmp/declare_cngn.txt
	@echo ""
	@echo "=== Declaring Cngn2 ==="
	$(SNCAST_LOCAL) declare --url http://127.0.0.1:5050/rpc --contract-name Cngn2 2>&1 | tee /tmp/declare_cngn2.txt
	@echo ""
	@echo "All contracts declared."
	@echo "Copy the Class Hash values from above and set them in deploy-all."

.PHONY: deploy-all
deploy-all:
	@echo "Deploying all contracts in dependency order..."
	@echo ""
	@if [ -z "$(OWNER)" ]; then \
		echo "Error: OWNER not set. Run: make deploy-all OWNER=0x<your_address>"; \
		exit 1; \
	fi
	@if [ -z "$(OPS_CLASS)" ] || [ -z "$(OPS2_CLASS)" ] || [ -z "$(FWD_CLASS)" ] || [ -z "$(CNGN_CLASS)" ] || [ -z "$(CNGN2_CLASS)" ]; then \
		echo "Error: Class hashes not set. Run declare-all first, then:"; \
		echo "  make deploy-all OWNER=<addr> OPS_CLASS=<hash> OPS2_CLASS=<hash> FWD_CLASS=<hash> CNGN_CLASS=<hash> CNGN2_CLASS=<hash>"; \
		exit 1; \
	fi

	@echo "=== [1/5] Deploying Operations ==="
	$(SNCAST_LOCAL) deploy --url http://127.0.0.1:5050/rpc \
		--class-hash $(OPS_CLASS) \
		--arguments "$(OWNER)" 2>&1 | tee /tmp/deploy_ops.txt
	@grep "Contract Address" /tmp/deploy_ops.txt | awk '{print $$NF}' > .ops_address
	@echo "Operations deployed at: $$(cat .ops_address)"

	@echo ""
	@echo "=== [2/5] Deploying Operations2 ==="
	$(SNCAST_LOCAL) deploy --url http://127.0.0.1:5050/rpc \
		--class-hash $(OPS2_CLASS) \
		--arguments "$(OWNER)" 2>&1 | tee /tmp/deploy_ops2.txt
	@grep "Contract Address" /tmp/deploy_ops2.txt | awk '{print $$NF}' > .ops2_address
	@echo "Operations2 deployed at: $$(cat .ops2_address)"

	@echo ""
	@echo "=== [3/5] Deploying Forwarder ==="
	$(SNCAST_LOCAL) deploy --url http://127.0.0.1:5050/rpc \
		--class-hash $(FWD_CLASS) \
		--arguments "$$(cat .ops2_address),$(OWNER)" 2>&1 | tee /tmp/deploy_fwd.txt
	@grep "Contract Address" /tmp/deploy_fwd.txt | awk '{print $$NF}' > .fwd_address
	@echo "Forwarder deployed at: $$(cat .fwd_address)"

	@echo ""
	@echo "=== [4/5] Deploying Cngn ==="
	$(SNCAST_LOCAL) deploy --url http://127.0.0.1:5050/rpc \
		--class-hash $(CNGN_CLASS) \
		--arguments "$$(cat .fwd_address),$$(cat .ops_address),$(OWNER)" 2>&1 | tee /tmp/deploy_cngn.txt
	@grep "Contract Address" /tmp/deploy_cngn.txt | awk '{print $$NF}' > .cngn_address
	@echo "Cngn deployed at: $$(cat .cngn_address)"

	@echo ""
	@echo "=== [5/5] Deploying Cngn2 ==="
	$(SNCAST_LOCAL) deploy --url http://127.0.0.1:5050/rpc \
		--class-hash $(CNGN2_CLASS) \
		--arguments "$$(cat .fwd_address),$$(cat .ops2_address),$(OWNER)" 2>&1 | tee /tmp/deploy_cngn2.txt
	@grep "Contract Address" /tmp/deploy_cngn2.txt | awk '{print $$NF}' > .cngn2_address
	@echo "Cngn2 deployed at: $$(cat .cngn2_address)"

	@echo ""
	@echo "============================================================"
	@echo "  Deployment complete!"
	@echo "============================================================"
	@echo "  Operations:  $$(cat .ops_address)"
	@echo "  Operations2: $$(cat .ops2_address)"
	@echo "  Forwarder:   $$(cat .fwd_address)"
	@echo "  Cngn:        $$(cat .cngn_address)"
	@echo "  Cngn2:       $$(cat .cngn2_address)"
	@echo "============================================================"

# =============================================================================
# OPERATIONS2 — write (owner-only, uses sncast with accounts file)
# =============================================================================

.PHONY: add-minter
add-minter:
	@[ -n "$(ADDR)" ] || (echo "Usage: make add-minter ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found. Run deploy-all first."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function add_can_mint \
		--arguments "$(ADDR)"

.PHONY: remove-minter
remove-minter:
	@[ -n "$(ADDR)" ] || (echo "Usage: make remove-minter ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function remove_can_mint \
		--arguments "$(ADDR)"

.PHONY: set-mint-amount
set-mint-amount:
	@[ -n "$(ADDR)" ] || (echo "Usage: make set-mint-amount ADDR=<address> AMOUNT=<u256>"; exit 1)
	@[ -n "$(AMOUNT)" ] || (echo "Usage: make set-mint-amount ADDR=<address> AMOUNT=<u256>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function add_mint_amount \
		--calldata "$(ADDR) $(AMOUNT) 0"

.PHONY: remove-mint-amount
remove-mint-amount:
	@[ -n "$(ADDR)" ] || (echo "Usage: make remove-mint-amount ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function remove_mint_amount \
		--arguments "$(ADDR)"

.PHONY: add-forwarder
add-forwarder:
	@[ -n "$(ADDR)" ] || (echo "Usage: make add-forwarder ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function add_can_forward \
		--arguments "$(ADDR)"

.PHONY: remove-forwarder
remove-forwarder:
	@[ -n "$(ADDR)" ] || (echo "Usage: make remove-forwarder ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function remove_can_forward \
		--arguments "$(ADDR)"

.PHONY: add-trusted
add-trusted:
	@[ -n "$(ADDR)" ] || (echo "Usage: make add-trusted ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function add_trusted_contract \
		--arguments "$(ADDR)"

.PHONY: blacklist
blacklist:
	@[ -n "$(ADDR)" ] || (echo "Usage: make blacklist ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function add_black_list \
		--arguments "$(ADDR)"

.PHONY: unblacklist
unblacklist:
	@[ -n "$(ADDR)" ] || (echo "Usage: make unblacklist ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function remove_black_list \
		--arguments "$(ADDR)"

.PHONY: whitelist-internal
whitelist-internal:
	@[ -n "$(ADDR)" ] || (echo "Usage: make whitelist-internal ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function whitelist_internal_user \
		--arguments "$(ADDR)"

.PHONY: whitelist-external
whitelist-external:
	@[ -n "$(ADDR)" ] || (echo "Usage: make whitelist-external ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function whitelist_external_sender \
		--arguments "$(ADDR)"

.PHONY: pause-ops2
pause-ops2:
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function pause

.PHONY: unpause-ops2
unpause-ops2:
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function unpause

# =============================================================================
# OPERATIONS2 — read
# =============================================================================

.PHONY: can-mint
can-mint:
	@[ -n "$(ADDR)" ] || (echo "Usage: make can-mint ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function can_mint \
		--arguments "$(ADDR)"

.PHONY: can-forward
can-forward:
	@[ -n "$(ADDR)" ] || (echo "Usage: make can-forward ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function can_forward \
		--arguments "$(ADDR)"

.PHONY: mint-amount
mint-amount:
	@[ -n "$(ADDR)" ] || (echo "Usage: make mint-amount ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function mint_amount \
		--arguments "$(ADDR)"

.PHONY: is-blacklisted
is-blacklisted:
	@[ -n "$(ADDR)" ] || (echo "Usage: make is-blacklisted ADDR=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function is_black_listed \
		--arguments "$(ADDR)"

# =============================================================================
# CNGN2 — write
# =============================================================================

.PHONY: mint
mint:
	@[ -n "$(AMOUNT)" ] || (echo "Usage: make mint AMOUNT=<u256> RECIPIENT=<address>"; exit 1)
	@[ -n "$(RECIPIENT)" ] || (echo "Usage: make mint AMOUNT=<u256> RECIPIENT=<address>"; exit 1)
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	@echo "Note: caller must be an authorized minter with matching mint_amount."
	@echo "      Run 'make mint-full' to authorize + mint in one step."
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function mint \
		--calldata "$(AMOUNT) 0 $(RECIPIENT)"

.PHONY: mint-full
mint-full:
	@[ -n "$(AMOUNT)" ] || (echo "Usage: make mint-full AMOUNT=<u256> RECIPIENT=<address>"; exit 1)
	@[ -n "$(RECIPIENT)" ] || (echo "Usage: make mint-full AMOUNT=<u256> RECIPIENT=<address>"; exit 1)
	@[ -n "$(OPS2_ADDR)" ] || (echo "Error: .ops2_address not found. Run deploy-all first."; exit 1)
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found. Run deploy-all first."; exit 1)
	@MINTER=$$(grep '"address"' $(ACCOUNTS_FILE) | head -1 | sed 's/.*: "\(.*\)".*/\1/'); \
	echo ""; \
	echo "=== [1/3] Authorizing minter: $$MINTER ==="; \
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function add_can_mint \
		--arguments "$$MINTER"; \
	echo ""; \
	echo "=== [2/3] Setting mint amount: $(AMOUNT) ==="; \
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(OPS2_ADDR) \
		--function add_mint_amount \
		--calldata "$$MINTER $(AMOUNT) 0"; \
	echo ""; \
	echo "=== [3/3] Minting $(AMOUNT) to $(RECIPIENT) ==="; \
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function mint \
		--calldata "$(AMOUNT) 0 $(RECIPIENT)"; \
	echo ""; \
	echo "Mint complete!"

.PHONY: transfer
transfer:
	@[ -n "$(RECIPIENT)" ] || (echo "Usage: make transfer RECIPIENT=<address> AMOUNT=<u256>"; exit 1)
	@[ -n "$(AMOUNT)" ] || (echo "Usage: make transfer RECIPIENT=<address> AMOUNT=<u256>"; exit 1)
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function transfer \
		--calldata "$(RECIPIENT) $(AMOUNT) 0"

.PHONY: approve
approve:
	@[ -n "$(SPENDER)" ] || (echo "Usage: make approve SPENDER=<address> AMOUNT=<u256>"; exit 1)
	@[ -n "$(AMOUNT)" ] || (echo "Usage: make approve SPENDER=<address> AMOUNT=<u256>"; exit 1)
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function approve \
		--calldata "$(SPENDER) $(AMOUNT) 0"

.PHONY: burn
burn:
	@[ -n "$(AMOUNT)" ] || (echo "Usage: make burn AMOUNT=<u256>"; exit 1)
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function burn_by_user \
		--calldata "$(AMOUNT) 0"

.PHONY: destroy-funds
destroy-funds:
	@[ -n "$(ADDR)" ] || (echo "Usage: make destroy-funds ADDR=<blacklisted_address>"; exit 1)
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function destroy_black_funds \
		--arguments "$(ADDR)"

.PHONY: pause-cngn2
pause-cngn2:
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function pause

.PHONY: unpause-cngn2
unpause-cngn2:
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function unpause

# =============================================================================
# CNGN2 — read
# =============================================================================

.PHONY: balance
balance:
	@[ -n "$(ADDR)" ] || (echo "Usage: make balance ADDR=<address>"; exit 1)
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function balance_of \
		--arguments "$(ADDR)"

.PHONY: total-supply
total-supply:
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function total_supply

.PHONY: allowance
allowance:
	@[ -n "$(OWNER)" ] || (echo "Usage: make allowance OWNER=<address> SPENDER=<address>"; exit 1)
	@[ -n "$(SPENDER)" ] || (echo "Usage: make allowance OWNER=<address> SPENDER=<address>"; exit 1)
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function allowance \
		--arguments "$(OWNER),$(SPENDER)"

.PHONY: token-name
token-name:
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function name

.PHONY: token-symbol
token-symbol:
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function symbol

.PHONY: token-decimals
token-decimals:
	@[ -n "$(CNGN2_ADDR)" ] || (echo "Error: .cngn2_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(CNGN2_ADDR) \
		--function decimals

# =============================================================================
# FORWARDER — write
# =============================================================================

.PHONY: authorize-bridge
authorize-bridge:
	@[ -n "$(ADDR)" ] || (echo "Usage: make authorize-bridge ADDR=<bridge_address>"; exit 1)
	@[ -n "$(FWD_ADDR)" ] || (echo "Error: .fwd_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(FWD_ADDR) \
		--function authorize_bridge \
		--arguments "$(ADDR)"

.PHONY: deauthorize-bridge
deauthorize-bridge:
	@[ -n "$(ADDR)" ] || (echo "Usage: make deauthorize-bridge ADDR=<bridge_address>"; exit 1)
	@[ -n "$(FWD_ADDR)" ] || (echo "Error: .fwd_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(FWD_ADDR) \
		--function deauthorize_bridge \
		--arguments "$(ADDR)"

.PHONY: pause-forwarder
pause-forwarder:
	@[ -n "$(FWD_ADDR)" ] || (echo "Error: .fwd_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(FWD_ADDR) \
		--function pause

.PHONY: unpause-forwarder
unpause-forwarder:
	@[ -n "$(FWD_ADDR)" ] || (echo "Error: .fwd_address not found."; exit 1)
	$(SNCAST_LOCAL) invoke --url http://127.0.0.1:5050/rpc \
		--contract-address $(FWD_ADDR) \
		--function unpause

# =============================================================================
# FORWARDER — read
# =============================================================================

.PHONY: is-authorized
is-authorized:
	@[ -n "$(ADDR)" ] || (echo "Usage: make is-authorized ADDR=<bridge_address>"; exit 1)
	@[ -n "$(FWD_ADDR)" ] || (echo "Error: .fwd_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(FWD_ADDR) \
		--function is_authorized_bridge \
		--arguments "$(ADDR)"

.PHONY: get-nonce
get-nonce:
	@[ -n "$(ADDR)" ] || (echo "Usage: make get-nonce ADDR=<address>"; exit 1)
	@[ -n "$(FWD_ADDR)" ] || (echo "Error: .fwd_address not found."; exit 1)
	sncast call --url http://127.0.0.1:5050/rpc \
		--contract-address $(FWD_ADDR) \
		--function get_nonce \
		--arguments "$(ADDR)"

# =============================================================================
# CLEANUP
# =============================================================================

.PHONY: clean
clean:
	rm -rf target

.PHONY: clean-all
clean-all: clean
	rm -f .ops_address .ops2_address .fwd_address .cngn_address .cngn2_address
	rm -f /tmp/declare_*.txt /tmp/deploy_*.txt
