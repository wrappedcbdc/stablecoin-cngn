#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV="${ENV:-local}"
CANTON_CONF="${CANTON_CONF:-$PROJECT_ROOT/config/canton.${ENV}.conf}"
DAR_NAME="cngn-1.0.0.dar"
DAR="$PROJECT_ROOT/.daml/dist/$DAR_NAME"
NODE_URL="${CANTON_LEDGER_URL:-localhost:6865}"

LEDGER_HOST="$(cut -d: -f1 <<< "$NODE_URL")"
LEDGER_PORT="$(cut -d: -f2 <<< "$NODE_URL")"

# ── Helpers ───────────────────────────────────────────────
log()  { echo "==> $*"; }
fail() { echo "[ERROR] $*" >&2; exit 1; }

# ── Preflight checks ──────────────────────────────────────
log "Environment: $ENV"
log "Canton config: $CANTON_CONF"

[[ -f "$CANTON_CONF" ]] || fail "Canton config not found: $CANTON_CONF"
command -v daml   &>/dev/null || fail "'daml' not found in PATH"
command -v canton &>/dev/null || fail "'canton' not found in PATH"

# ── 1. Start Canton node (background) ─────────────────────
log "Starting Canton node..."
canton -c "$CANTON_CONF" &
CANTON_PID=$!
trap 'log "Stopping Canton (pid $CANTON_PID)..."; kill "$CANTON_PID" 2>/dev/null || true' EXIT

# Wait for ledger API to be ready
log "Waiting for ledger API on $NODE_URL..."
for i in $(seq 1 30); do
  nc -z "$LEDGER_HOST" "$LEDGER_PORT" 2>/dev/null && break
  [[ $i -eq 30 ]] && fail "Ledger API did not become ready in time"
  sleep 2
done
log "Ledger API is up."

# ── 2. Build DAR ──────────────────────────────────────────
log "Building DAR..."
(cd "$PROJECT_ROOT" && daml build)
[[ -f "$DAR" ]] || fail "DAR not found after build: $DAR"

# ── 3. Upload DAR ─────────────────────────────────────────
log "Uploading DAR to $NODE_URL..."
daml ledger upload-dar \
  --host "$LEDGER_HOST" \
  --port "$LEDGER_PORT" \
  "$DAR"

# ── 4. Run Setup script ───────────────────────────────────
log "Running Setup:initialize..."
daml script \
  --dar "$DAR" \
  --script-name "Setup:initialize" \
  --ledger-host "$LEDGER_HOST" \
  --ledger-port "$LEDGER_PORT"

log "Deployment complete. Canton node running (pid $CANTON_PID)."
log "Ledger API: $NODE_URL"

# Keep Canton alive (remove if running Canton as a separate service)
wait "$CANTON_PID"