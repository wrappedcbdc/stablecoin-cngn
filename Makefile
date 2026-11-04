# =============================================================================
# cNGN Protocol — Makefile
# =============================================================================
# Direct commands for building, testing, deploying, and managing cNGN on Sui.
# =============================================================================

.PHONY: help
help:
	@$(MAKE) -C sui-contract help

# =============================================================================
# BUILD & TEST
# =============================================================================

.PHONY: build
build:
	$(MAKE) -C sui-contract build

.PHONY: test
test:
	$(MAKE) -C sui-contract test

# =============================================================================
# DEPLOYMENT & UPGRADE
# =============================================================================

.PHONY: deploy
deploy:
	$(MAKE) -C sui-contract deploy

.PHONY: upgrade
upgrade:
	$(MAKE) -C sui-contract upgrade

# =============================================================================
# ADMIN / ACCESS CONTROL
# =============================================================================

.PHONY: grant-mint
grant-mint:
	$(MAKE) -C sui-contract grant-mint MINTER="$(MINTER)" AMOUNT="$(AMOUNT)"

.PHONY: revoke-mint
revoke-mint:
	$(MAKE) -C sui-contract revoke-mint MINTER="$(MINTER)"

.PHONY: add-minter
add-minter:
	$(MAKE) -C sui-contract add-minter MINTER="$(MINTER)"

.PHONY: remove-minter
remove-minter:
	$(MAKE) -C sui-contract remove-minter MINTER="$(MINTER)"

.PHONY: set-mint-amount
set-mint-amount:
	$(MAKE) -C sui-contract set-mint-amount MINTER="$(MINTER)" AMOUNT="$(AMOUNT)"

.PHONY: remove-mint-amount
remove-mint-amount:
	$(MAKE) -C sui-contract remove-mint-amount MINTER="$(MINTER)"

.PHONY: add-forwarder
add-forwarder:
	$(MAKE) -C sui-contract add-forwarder FORWARDER="$(FORWARDER)"

.PHONY: remove-forwarder
remove-forwarder:
	$(MAKE) -C sui-contract remove-forwarder FORWARDER="$(FORWARDER)"

.PHONY: add-trusted
add-trusted:
	$(MAKE) -C sui-contract add-trusted CONTRACT="$(CONTRACT)"

.PHONY: remove-trusted
remove-trusted:
	$(MAKE) -C sui-contract remove-trusted CONTRACT="$(CONTRACT)"

.PHONY: blacklist
blacklist:
	$(MAKE) -C sui-contract blacklist USER="$(USER)"

.PHONY: unblacklist
unblacklist:
	$(MAKE) -C sui-contract unblacklist USER="$(USER)"

.PHONY: pause
pause:
	$(MAKE) -C sui-contract pause

.PHONY: unpause
unpause:
	$(MAKE) -C sui-contract unpause

# =============================================================================
# TOKEN OPERATIONS
# =============================================================================

.PHONY: mint
mint:
	$(MAKE) -C sui-contract mint AMOUNT="$(AMOUNT)" RECIPIENT="$(RECIPIENT)"

.PHONY: mint-full
mint-full:
	$(MAKE) -C sui-contract mint-full MINTER="$(MINTER)" AMOUNT="$(AMOUNT)" RECIPIENT="$(RECIPIENT)"

.PHONY: burn
burn:
	$(MAKE) -C sui-contract burn COIN_ID="$(COIN_ID)"

# =============================================================================
# INSPECT & CLEANUP
# =============================================================================

.PHONY: query-state
query-state:
	$(MAKE) -C sui-contract query-state

.PHONY: show-config
show-config:
	$(MAKE) -C sui-contract show-config

.PHONY: clean
clean:
	$(MAKE) -C sui-contract clean
