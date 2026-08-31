# =============================================================================
# cNGN Sui Move Contract — Makefile
# =============================================================================
# Standard interface for building, testing, deploying, upgrading, and interacting
# with the cNGN stablecoin contract on the Sui network.
#
# Usage:
#   make <target> [ARGS...]
# =============================================================================

GAS_BUDGET_DEPLOY  ?= 150000000
GAS_BUDGET_CALL    ?= 50000000
CONFIG_FILE        ?= deployment.json
ENV_FILE           ?= .env

# Load deployed IDs from deployment.json if it exists
PACKAGE_ID         ?= $(shell jq -r '.packageId // empty' $(CONFIG_FILE) 2>/dev/null)
UPGRADE_CAP_ID     ?= $(shell jq -r '.upgradeCapId // empty' $(CONFIG_FILE) 2>/dev/null)
ADMIN_CAP_ID       ?= $(shell jq -r '.adminCapId // empty' $(CONFIG_FILE) 2>/dev/null)
ADMIN_REGISTRY_ID  ?= $(shell jq -r '.adminRegistryId // empty' $(CONFIG_FILE) 2>/dev/null)
COIN_STATE_ID      ?= $(shell jq -r '.coinStateId // empty' $(CONFIG_FILE) 2>/dev/null)
COIN_METADATA_ID   ?= $(shell jq -r '.coinMetadataId // empty' $(CONFIG_FILE) 2>/dev/null)
DENY_LIST_ID       ?= $(shell jq -r '.denyListId // "0x0000000000000000000000000000000000000000000000000000000000000403"' $(CONFIG_FILE) 2>/dev/null)

.PHONY: help
help:
	@echo ""
	@echo "============================================================"
	@echo "  cNGN Sui Move Contract — Make Targets"
	@echo "============================================================"
	@echo ""
	@echo "  BUILD & TEST"
	@echo "    make build               Compile Move package"
	@echo "    make test                Run all unit tests"
	@echo ""
	@echo "  DEPLOYMENT & UPGRADES"
	@echo "    make deploy              Publish package and export deployment.json"
	@echo "    make upgrade             Upgrade package bytecode via UpgradeCap"
	@echo ""
	@echo "  ADMIN & PERMISSION MANAGEMENT (AdminCap Gated)"
	@echo "    make grant-mint          MINTER=<addr> AMOUNT=<u64>  (atomic auth + amount)"
	@echo "    make revoke-mint         MINTER=<addr>               (revoke minter)"
	@echo "    make add-minter          MINTER=<addr>"
	@echo "    make remove-minter       MINTER=<addr>"
	@echo "    make set-mint-amount     MINTER=<addr> AMOUNT=<u64>"
	@echo "    make remove-mint-amount  MINTER=<addr>"
	@echo "    make add-forwarder       FORWARDER=<addr>"
	@echo "    make remove-forwarder    FORWARDER=<addr>"
	@echo "    make add-trusted         CONTRACT=<addr>"
	@echo "    make remove-trusted      CONTRACT=<addr>"
	@echo "    make blacklist           USER=<addr>"
	@echo "    make unblacklist         USER=<addr>"
	@echo "    make pause"
	@echo "    make unpause"
	@echo ""
	@echo "  TOKEN OPERATIONS"
	@echo "    make mint                AMOUNT=<u64> RECIPIENT=<addr>"
	@echo "    make mint-full           MINTER=<addr> AMOUNT=<u64> RECIPIENT=<addr> (grant + mint)"
	@echo "    make burn                COIN_ID=<object_id>"
	@echo ""
	@echo "  STATE & QUERIES"
	@echo "    make query-state         Inspect shared state objects"
	@echo "    make show-config         Display loaded deployment parameters"
	@echo "    make clean               Remove build artifacts"
	@echo ""

# =============================================================================
# BUILD & TEST
# =============================================================================

.PHONY: build
build:
	@echo "=== Building Sui Move Package ==="
	sui move build

.PHONY: test
test:
	@echo "=== Running Sui Move Unit Tests ==="
	sui move test

# =============================================================================
# DEPLOYMENT & UPGRADE
# =============================================================================

.PHONY: deploy
deploy:
	@echo "=== Deploying cNGN to Active Sui Network ==="
	chmod +x scripts/deploy.sh
	./scripts/deploy.sh

.PHONY: upgrade
upgrade:
	@echo "=== Upgrading cNGN Package ==="
	chmod +x scripts/upgrade.sh
	./scripts/upgrade.sh

# =============================================================================
# ADMIN / ACCESS CONTROL (Operations.sol Parity)
# =============================================================================

.PHONY: grant-mint
grant-mint:
	@[ -n "$(MINTER)" ] || (echo "Usage: make grant-mint MINTER=<address> AMOUNT=<u64>"; exit 1)
	@[ -n "$(AMOUNT)" ] || (echo "Usage: make grant-mint MINTER=<address> AMOUNT=<u64>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing. Run 'make deploy' first."; exit 1)
	@echo "Granting single-use mint permission to $(MINTER) for amount $(AMOUNT)..."
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "admin" \
		--function "grant_mint_permission" \
		--args "$(ADMIN_CAP_ID)" "$(ADMIN_REGISTRY_ID)" "$(MINTER)" "$(AMOUNT)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: revoke-mint
revoke-mint:
	@[ -n "$(MINTER)" ] || (echo "Usage: make revoke-mint MINTER=<address>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	@echo "Revoking mint permission from $(MINTER)..."
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "admin" \
		--function "revoke_mint_permission" \
		--args "$(ADMIN_CAP_ID)" "$(ADMIN_REGISTRY_ID)" "$(MINTER)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: add-minter
add-minter:
	@[ -n "$(MINTER)" ] || (echo "Usage: make add-minter MINTER=<address>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "admin" \
		--function "add_can_mint" \
		--args "$(ADMIN_CAP_ID)" "$(ADMIN_REGISTRY_ID)" "$(MINTER)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: remove-minter
remove-minter:
	@[ -n "$(MINTER)" ] || (echo "Usage: make remove-minter MINTER=<address>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "admin" \
		--function "remove_can_mint_by_admin" \
		--args "$(ADMIN_CAP_ID)" "$(ADMIN_REGISTRY_ID)" "$(MINTER)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: set-mint-amount
set-mint-amount:
	@[ -n "$(MINTER)" ] || (echo "Usage: make set-mint-amount MINTER=<address> AMOUNT=<u64>"; exit 1)
	@[ -n "$(AMOUNT)" ] || (echo "Usage: make set-mint-amount MINTER=<address> AMOUNT=<u64>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "admin" \
		--function "add_mint_amount" \
		--args "$(ADMIN_CAP_ID)" "$(ADMIN_REGISTRY_ID)" "$(MINTER)" "$(AMOUNT)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: remove-mint-amount
remove-mint-amount:
	@[ -n "$(MINTER)" ] || (echo "Usage: make remove-mint-amount MINTER=<address>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "admin" \
		--function "remove_mint_amount" \
		--args "$(ADMIN_CAP_ID)" "$(ADMIN_REGISTRY_ID)" "$(MINTER)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: add-forwarder
add-forwarder:
	@[ -n "$(FORWARDER)" ] || (echo "Usage: make add-forwarder FORWARDER=<address>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "admin" \
		--function "add_can_forward" \
		--args "$(ADMIN_CAP_ID)" "$(ADMIN_REGISTRY_ID)" "$(FORWARDER)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: remove-forwarder
remove-forwarder:
	@[ -n "$(FORWARDER)" ] || (echo "Usage: make remove-forwarder FORWARDER=<address>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "admin" \
		--function "remove_can_forward" \
		--args "$(ADMIN_CAP_ID)" "$(ADMIN_REGISTRY_ID)" "$(FORWARDER)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: add-trusted
add-trusted:
	@[ -n "$(CONTRACT)" ] || (echo "Usage: make add-trusted CONTRACT=<address>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "admin" \
		--function "add_trusted_contract" \
		--args "$(ADMIN_CAP_ID)" "$(ADMIN_REGISTRY_ID)" "$(CONTRACT)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: remove-trusted
remove-trusted:
	@[ -n "$(CONTRACT)" ] || (echo "Usage: make remove-trusted CONTRACT=<address>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "admin" \
		--function "remove_trusted_contract" \
		--args "$(ADMIN_CAP_ID)" "$(ADMIN_REGISTRY_ID)" "$(CONTRACT)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: blacklist
blacklist:
	@[ -n "$(USER)" ] || (echo "Usage: make blacklist USER=<address>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	@echo "Adding $(USER) to validator-enforced DenyList..."
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "cngn" \
		--function "add_black_list" \
		--args "$(ADMIN_CAP_ID)" "$(COIN_STATE_ID)" "$(DENY_LIST_ID)" "$(USER)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: unblacklist
unblacklist:
	@[ -n "$(USER)" ] || (echo "Usage: make unblacklist USER=<address>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	@echo "Removing $(USER) from DenyList..."
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "cngn" \
		--function "remove_black_list" \
		--args "$(ADMIN_CAP_ID)" "$(COIN_STATE_ID)" "$(DENY_LIST_ID)" "$(USER)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: pause
pause:
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	@echo "Enabling global pause on cNGN secondary transfers..."
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "cngn" \
		--function "pause" \
		--args "$(ADMIN_CAP_ID)" "$(COIN_STATE_ID)" "$(DENY_LIST_ID)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: unpause
unpause:
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	@echo "Disabling global pause on cNGN secondary transfers..."
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "cngn" \
		--function "unpause" \
		--args "$(ADMIN_CAP_ID)" "$(COIN_STATE_ID)" "$(DENY_LIST_ID)" \
		--gas-budget $(GAS_BUDGET_CALL)

# =============================================================================
# TOKEN OPERATIONS
# =============================================================================

.PHONY: mint
mint:
	@[ -n "$(AMOUNT)" ] || (echo "Usage: make mint AMOUNT=<u64> RECIPIENT=<address>"; exit 1)
	@[ -n "$(RECIPIENT)" ] || (echo "Usage: make mint AMOUNT=<u64> RECIPIENT=<address>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	@echo "Minting $(AMOUNT) base units of cNGN to $(RECIPIENT)..."
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "cngn" \
		--function "mint" \
		--args "$(COIN_STATE_ID)" "$(ADMIN_REGISTRY_ID)" "$(DENY_LIST_ID)" "$(AMOUNT)" "$(RECIPIENT)" \
		--gas-budget $(GAS_BUDGET_CALL)

.PHONY: mint-full
mint-full:
	@[ -n "$(MINTER)" ] || (echo "Usage: make mint-full MINTER=<address> AMOUNT=<u64> RECIPIENT=<address>"; exit 1)
	@[ -n "$(AMOUNT)" ] || (echo "Usage: make mint-full MINTER=<address> AMOUNT=<u64> RECIPIENT=<address>"; exit 1)
	@[ -n "$(RECIPIENT)" ] || (echo "Usage: make mint-full MINTER=<address> AMOUNT=<u64> RECIPIENT=<address>"; exit 1)
	@echo "=== [1/2] Granting mint permission ==="
	$(MAKE) grant-mint MINTER=$(MINTER) AMOUNT=$(AMOUNT)
	@echo "=== [2/2] Executing mint ==="
	$(MAKE) mint AMOUNT=$(AMOUNT) RECIPIENT=$(RECIPIENT)

.PHONY: burn
burn:
	@[ -n "$(COIN_ID)" ] || (echo "Usage: make burn COIN_ID=<object_id>"; exit 1)
	@[ -n "$(PACKAGE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	@echo "Burning coin $(COIN_ID)..."
	sui client call \
		--package "$(PACKAGE_ID)" \
		--module "cngn" \
		--function "burn_by_user" \
		--args "$(COIN_STATE_ID)" "$(COIN_ID)" \
		--gas-budget $(GAS_BUDGET_CALL)

# =============================================================================
# INSPECT & CLEANUP
# =============================================================================

.PHONY: query-state
query-state:
	@[ -n "$(COIN_STATE_ID)" ] || (echo "Error: deployment.json missing."; exit 1)
	@echo "=== Fetching CoinState ==="
	sui client object "$(COIN_STATE_ID)"
	@echo ""
	@echo "=== Fetching AdminRegistry ==="
	sui client object "$(ADMIN_REGISTRY_ID)"

.PHONY: show-config
show-config:
	@echo "Package ID:        $(PACKAGE_ID)"
	@echo "UpgradeCap ID:     $(UPGRADE_CAP_ID)"
	@echo "AdminCap ID:       $(ADMIN_CAP_ID)"
	@echo "AdminRegistry ID:  $(ADMIN_REGISTRY_ID)"
	@echo "CoinState ID:      $(COIN_STATE_ID)"
	@echo "CoinMetadata ID:   $(COIN_METADATA_ID)"
	@echo "DenyList ID:       $(DENY_LIST_ID)"

.PHONY: clean
clean:
	rm -rf build/
	@echo "✓ Cleaned build artifacts."
