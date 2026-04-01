# ── cNGN Canton — Makefile ────────────────────────────────
# Usage: make <target> [ENV=local|staging|prod]
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
SCRIPTS          := $(PROJECT_ROOT)/scripts

.DEFAULT_GOAL := help

# ── Help ──────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  cNGN Canton — available targets"
	@echo ""
	@echo "  Dev workflow"
	@echo "    make build              Build the DAR"
	@echo "    make start              Start Canton node (foreground)"
	@echo "    make start-bg           Start Canton node (background)"
	@echo "    make stop               Stop background Canton node"
	@echo "    make upload             Upload DAR to running node"
	@echo "    make setup              Run Setup:initialize script"
	@echo "    make allocate-parties   Allocate owner/minter/relayer"
	@echo ""
	@echo "  Composite"
	@echo "    make deploy             build + start-bg + upload + setup"
	@echo "    make redeploy           stop + deploy"
	@echo "    make reset              stop + clean + deploy"
	@echo ""
	@echo "  Checks"
	@echo "    make test               Run daml test"
	@echo "    make lint               Run daml lint"
	@echo "    make check-ready        Wait for ledger API to be ready"
	@echo ""
	@echo "  Cleanup"
	@echo "    make clean              Remove build artefacts"
	@echo "    make clean-all          clean + remove Canton data"
	@echo ""
	@echo "  Options"
	@echo "    ENV=local|staging|prod  (default: local)"
	@echo "    CANTON_LEDGER_URL=host:port  (default: localhost:6865)"
	@echo ""

# ── Build ─────────────────────────────────────────────────
.PHONY: build
build:
	@echo "==> Building DAR (ENV=$(ENV))..."
	daml build
	@echo "==> DAR ready: $(DAR)"

$(DAR): build

# ── Canton node ───────────────────────────────────────────
.PHONY: start
start: _check-conf
	@echo "==> Starting Canton node (foreground, ENV=$(ENV))..."
	canton -c "$(CANTON_CONF)"

.PHONY: start-bg
start-bg: _check-conf
	@echo "==> Starting Canton node (background, ENV=$(ENV))..."
	canton -c "$(CANTON_CONF)" &
	@echo $$! > /tmp/canton-cngn.pid
	@echo "==> Canton PID: $$(cat /tmp/canton-cngn.pid)"
	@$(MAKE) check-ready

.PHONY: stop
stop:
	@if [ -f /tmp/canton-cngn.pid ]; then \
		PID=$$(cat /tmp/canton-cngn.pid); \
		echo "==> Stopping Canton (pid $$PID)..."; \
		kill "$$PID" 2>/dev/null || true; \
		rm -f /tmp/canton-cngn.pid; \
		echo "==> Stopped."; \
	else \
		echo "==> No Canton PID file found — nothing to stop."; \
	fi

.PHONY: check-ready
check-ready:
	@echo "==> Waiting for ledger API on $(CANTON_LEDGER_URL)..."
	@for i in $$(seq 1 30); do \
		nc -z $(LEDGER_HOST) $(LEDGER_PORT) 2>/dev/null && break; \
		if [ $$i -eq 30 ]; then echo "[ERROR] Ledger API not ready after 60s" >&2; exit 1; fi; \
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

# ── Party allocation ──────────────────────────────────────
.PHONY: allocate-parties
allocate-parties:
	@echo "==> Allocating parties..."
	bash "$(SCRIPTS)/allocate-parties.sh"
	@echo "==> Parties allocated."

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
	@echo "==> Removing Canton data directories..."
	rm -rf .canton-data canton-data
	@echo "==> Full clean done."

# ── Internal guards ───────────────────────────────────────
.PHONY: _check-conf
_check-conf:
	@if [ ! -f "$(CANTON_CONF)" ]; then \
		echo "[ERROR] Canton config not found: $(CANTON_CONF)"; \
		echo "        Set ENV=local|staging|prod or CANTON_CONF=/path/to/canton.conf"; \
		exit 1; \
	fi