# ── cNGN Canton — Makefile ────────────────────────────────
# Usage: make <target> [ENV=local|staging|prod]
#
# Local dev/test (ENV=local, the default) runs against the Daml SDK's
# bundled `daml sandbox` — this is a real single-node Canton participant,
# not a mock. No external `canton` binary or hand-written Canton config
# is required for this path.
#
# staging/prod are expected to point at a real, separately-operated
# Canton deployment: set CANTON_CONF to a real Canton config file for
# that environment (config/canton.staging.conf and
# config/canton.prod.conf are placeholders — they are not filled in here
# because doing so requires real infrastructure details this repo does
# not have). If CANTON_CONF is empty or missing, `start`/`start-bg` fall
# back to the bundled sandbox regardless of ENV.
#
# Defaults
ENV              ?= local
CANTON_LEDGER_URL ?= localhost:6865
LEDGER_HOST      := $(word 1,$(subst :, ,$(CANTON_LEDGER_URL)))
LEDGER_PORT      := $(word 2,$(subst :, ,$(CANTON_LEDGER_URL)))

PROJECT_ROOT     := $(shell pwd)
CANTON_CONF      ?= $(PROJECT_ROOT)/config/canton.$(ENV).conf
DAR_NAME         := cngn-1.0.0.dar
DAR              := $(PROJECT_ROOT)/.daml/dist/$(DAR_NAME)
SANDBOX_PID_FILE := /tmp/canton-cngn.pid
SANDBOX_LOG_FILE := /tmp/canton-cngn-sandbox.log

.DEFAULT_GOAL := help

# ── Help ──────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  cNGN Canton — available targets"
	@echo ""
	@echo "  Dev workflow"
	@echo "    make build              Build the DAR"
	@echo "    make start              Start the ledger (foreground)"
	@echo "    make start-bg           Start the ledger (background)"
	@echo "    make stop               Stop the background ledger"
	@echo "    make upload             Upload DAR to the running ledger"
	@echo "    make setup              Run Setup:initialize script"
	@echo "    make list-parties       List parties known to the ledger"
	@echo ""
	@echo "  Composite"
	@echo "    make deploy             build + start-bg + upload + setup"
	@echo "    make redeploy           stop + deploy"
	@echo "    make reset              stop + clean + deploy"
	@echo ""
	@echo "  Action demos (run against a deployed ledger)"
	@echo "    make demo-mint          Mint proposal + execute, end to end"
	@echo "    make demo-transfer      Issue a holding and transfer part of it"
	@echo "    make demo-burn          Issue a holding and burn it"
	@echo "    make demo-token-pause   Per-holding Pause/UnPause"
	@echo "    make demo-allowance     Approve/increase/decrease/spend/revoke"
	@echo "    make demo-admin         Global pause, blacklist cascade, mint grant,"
	@echo "                            trusted contract add/remove"
	@echo "    make demo-forwarder     Relayer submits/pays for a mint the minter"
	@echo "                            signed, via explicit disclosure"
	@echo "    make demo-all           Run all of the above in one script"
	@echo ""
	@echo "  Checks"
	@echo "    make test               Run daml test"
	@echo "    make lint               Run daml lint"
	@echo "    make check-ready        Wait for ledger API to be ready"
	@echo ""
	@echo "  Cleanup"
	@echo "    make clean              Remove build artefacts"
	@echo "    make clean-all          clean + remove ledger data"
	@echo ""
	@echo "  Options"
	@echo "    ENV=local|staging|prod  (default: local)"
	@echo "    CANTON_LEDGER_URL=host:port  (default: localhost:6865)"
	@echo "    CANTON_CONF=/path/to/canton.conf  (real multi-node Canton;"
	@echo "                falls back to the bundled sandbox if unset/empty)"
	@echo ""

# ── Build ─────────────────────────────────────────────────
.PHONY: build
build:
	@echo "==> Building DAR (ENV=$(ENV))..."
	daml build
	@echo "==> DAR ready: $(DAR)"

$(DAR): build

# ── Ledger (sandbox or real Canton) ────────────────────────
.PHONY: start
start: $(DAR)
	@echo "==> Starting ledger (foreground, ENV=$(ENV))..."
	@if [ -s "$(CANTON_CONF)" ]; then \
		echo "==> Using Canton config: $(CANTON_CONF)"; \
		daml sandbox --dar "$(DAR)" --port $(LEDGER_PORT) -c "$(CANTON_CONF)"; \
	else \
		echo "==> No Canton config for ENV=$(ENV); using the Daml SDK's bundled"; \
		echo "    sandbox (a single-node Canton participant) on port $(LEDGER_PORT)."; \
		daml sandbox --dar "$(DAR)" --port $(LEDGER_PORT); \
	fi

.PHONY: start-bg
start-bg: $(DAR)
	@echo "==> Starting ledger in background (ENV=$(ENV))..."
	@if [ -s "$(CANTON_CONF)" ]; then \
		echo "==> Using Canton config: $(CANTON_CONF)"; \
		( daml sandbox --dar "$(DAR)" --port $(LEDGER_PORT) -c "$(CANTON_CONF)" \
			> "$(SANDBOX_LOG_FILE)" 2>&1 & echo $$! > "$(SANDBOX_PID_FILE)" ); \
	else \
		echo "==> No Canton config for ENV=$(ENV); using the Daml SDK's bundled sandbox."; \
		( daml sandbox --dar "$(DAR)" --port $(LEDGER_PORT) \
			> "$(SANDBOX_LOG_FILE)" 2>&1 & echo $$! > "$(SANDBOX_PID_FILE)" ); \
	fi
	@echo "==> Ledger PID: $$(cat $(SANDBOX_PID_FILE))"
	@echo "==> Logs: $(SANDBOX_LOG_FILE)"
	@$(MAKE) check-ready

.PHONY: stop
stop:
	@if [ -f "$(SANDBOX_PID_FILE)" ]; then \
		PID=$$(cat "$(SANDBOX_PID_FILE)"); \
		echo "==> Stopping ledger (pid $$PID)..."; \
		kill "$$PID" 2>/dev/null || true; \
		rm -f "$(SANDBOX_PID_FILE)"; \
		echo "==> Stopped."; \
	else \
		echo "==> No ledger PID file found — nothing to stop."; \
	fi

.PHONY: check-ready
check-ready:
	@echo "==> Waiting for ledger API on $(CANTON_LEDGER_URL)..."
	@for i in $$(seq 1 30); do \
		nc -z $(LEDGER_HOST) $(LEDGER_PORT) 2>/dev/null && break; \
		if [ $$i -eq 30 ]; then \
			echo "[ERROR] Ledger API not ready after 60s" >&2; \
			echo "        Check $(SANDBOX_LOG_FILE) for startup errors." >&2; \
			exit 1; \
		fi; \
		sleep 2; \
	done
	@echo "==> Ledger API is ready."

# ── DAR upload ────────────────────────────────────────────
.PHONY: upload
upload: $(DAR)
	@echo "==> Uploading DAR to $(CANTON_LEDGER_URL)..."
	daml ledger upload-dar \
		--host "$(LEDGER_HOST)" \
		--port "$(LEDGER_PORT)" \
		"$(DAR)"
	@echo "==> Upload complete."

# ── Setup script ──────────────────────────────────────────
.PHONY: setup
setup: $(DAR)
	@echo "==> Running Setup:initialize..."
	daml script \
		--dar "$(DAR)" \
		--script-name "Setup:initialize" \
		--ledger-host "$(LEDGER_HOST)" \
		--ledger-port "$(LEDGER_PORT)"
	@echo "==> Setup complete."

# ── Ledger inspection ───────────────────────────────────────
.PHONY: list-parties
list-parties:
	@echo "==> Parties known to $(CANTON_LEDGER_URL):"
	daml ledger list-parties \
		--host "$(LEDGER_HOST)" \
		--port "$(LEDGER_PORT)"

# ── Composite targets ─────────────────────────────────────
.PHONY: deploy
deploy: build start-bg upload setup
	@echo ""
	@echo "==> Deployment complete."
	@echo "    ENV:        $(ENV)"
	@echo "    Ledger API: $(CANTON_LEDGER_URL)"
	@echo "    DAR:        $(DAR)"
	@echo ""

.PHONY: redeploy
redeploy: stop deploy

.PHONY: reset
reset: stop clean deploy

# ── Action demos ────────────────────────────────────────────
# Each demo is a self-contained Daml Script (daml/Demo.daml): it
# allocates its own fresh parties and registries, then exercises exactly
# the capability named. Run `make deploy` first so the DAR is uploaded
# and the ledger is reachable at $(CANTON_LEDGER_URL).
.PHONY: demo-mint
demo-mint: $(DAR)
	@echo "==> Running mint demo..."
	daml script --dar "$(DAR)" --script-name Demo:mintFlow \
		--ledger-host "$(LEDGER_HOST)" --ledger-port "$(LEDGER_PORT)"

.PHONY: demo-transfer
demo-transfer: $(DAR)
	@echo "==> Running transfer demo..."
	daml script --dar "$(DAR)" --script-name Demo:transferFlow \
		--ledger-host "$(LEDGER_HOST)" --ledger-port "$(LEDGER_PORT)"

.PHONY: demo-burn
demo-burn: $(DAR)
	@echo "==> Running burn demo..."
	daml script --dar "$(DAR)" --script-name Demo:burnFlow \
		--ledger-host "$(LEDGER_HOST)" --ledger-port "$(LEDGER_PORT)"

.PHONY: demo-token-pause
demo-token-pause: $(DAR)
	@echo "==> Running per-token pause demo (CNGNToken.Pause/UnPause)..."
	daml script --dar "$(DAR)" --script-name Demo:pauseTokenFlow \
		--ledger-host "$(LEDGER_HOST)" --ledger-port "$(LEDGER_PORT)"

.PHONY: demo-allowance
demo-allowance: $(DAR)
	@echo "==> Running allowance demo (approve/increase/decrease/spend/revoke)..."
	daml script --dar "$(DAR)" --script-name Demo:allowanceFlow \
		--ledger-host "$(LEDGER_HOST)" --ledger-port "$(LEDGER_PORT)"

.PHONY: demo-admin
demo-admin: $(DAR)
	@echo "==> Running admin actions demo..."
	daml script --dar "$(DAR)" --script-name Demo:adminFlow \
		--ledger-host "$(LEDGER_HOST)" --ledger-port "$(LEDGER_PORT)"

.PHONY: demo-forwarder
demo-forwarder: $(DAR)
	@echo "==> Running forwarder demo (relayer executes via explicit disclosure)..."
	daml script --dar "$(DAR)" --script-name Demo:forwarderFlow \
		--ledger-host "$(LEDGER_HOST)" --ledger-port "$(LEDGER_PORT)"

.PHONY: demo-all
demo-all: $(DAR)
	@echo "==> Running all demo flows..."
	daml script --dar "$(DAR)" --script-name Demo:allFlows \
		--ledger-host "$(LEDGER_HOST)" --ledger-port "$(LEDGER_PORT)"

# ── Test & lint ───────────────────────────────────────────
.PHONY: test
test:
	@echo "==> Running daml test..."
	daml test

.PHONY: lint
lint:
	@echo "==> Running daml lint..."
	daml lint

# ── Cleanup ───────────────────────────────────────────────
.PHONY: clean
clean:
	@echo "==> Removing build artefacts..."
	rm -rf .daml/dist
	@echo "==> Clean done."

.PHONY: clean-all
clean-all: stop clean
	@echo "==> Removing ledger data directories and logs..."
	rm -rf .canton-data canton-data "$(SANDBOX_LOG_FILE)"
	@echo "==> Full clean done."
