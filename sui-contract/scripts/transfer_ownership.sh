#!/usr/bin/env bash
# ==============================================================================
# cNGN on Sui — Ownership Transfer Script
# ==============================================================================
# Usage:
#   ./transfer-ownership.sh check
#   ./transfer-ownership.sh transfer-all   <new_owner_address> [--dry-run]
#   ./transfer-ownership.sh transfer-admin <new_owner_address> [--dry-run]
#   ./transfer-ownership.sh transfer-upgrade <new_owner_address> [--dry-run]
#   ./transfer-ownership.sh verify <expected_owner_address>
#
# deployment.json must contain: adminCapId, upgradeCapId
# (UPGRADE_CAP_ID env var overrides upgradeCapId if the key is missing.)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${PACKAGE_DIR}/deployment.json"
GAS_BUDGET=50000000

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "Error: deployment.json not found! Run ./deploy.sh first."
  exit 1
fi

ADMIN_CAP_ID=$(jq -r '.adminCapId' "${CONFIG_FILE}")
UPGRADE_CAP_ID=$(jq -r '.upgradeCapId // empty' "${CONFIG_FILE}")
UPGRADE_CAP_ID=${UPGRADE_CAP_ID:-${UPGRADE_CAP_ID_ENV:-${UPGRADE_CAP_ID:-}}}

if [ -z "${UPGRADE_CAP_ID:-}" ]; then
  echo "Error: upgradeCapId not found in deployment.json."
  echo "Find it with:  sui client objects --json | jq '.[] | select(.data.type | test(\"UpgradeCap\"))'"
  echo "Then add it to deployment.json or run:  UPGRADE_CAP_ID_ENV=0x... ./transfer-ownership.sh ..."
  exit 1
fi

COMMAND=${1:-"help"}

# --- Helpers ---------------------------------------------------------------

validate_address() {
  local addr="$1"
  if ! [[ "${addr}" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo "Error: '${addr}' is not a valid 32-byte Sui address (0x + 64 hex chars)."
    exit 1
  fi
}

owner_of() {
  sui client object "$1" --json | jq -r '.owner.AddressOwner // "NOT_ADDRESS_OWNED"'
}

assert_held_by_active() {
  local label="$1" id="$2" active="$3"
  local owner
  owner=$(owner_of "${id}")
  if [ "${owner}" != "${active}" ]; then
    echo "Error: ${label} (${id}) is owned by ${owner}, not the active address ${active}."
    echo "Switch with: sui client switch --address <owner_address>"
    exit 1
  fi
}

confirm() {
  echo
  read -r -p "Type the first 10 chars of the new owner address to confirm: " ANSWER
  if [ "${ANSWER}" != "${1:0:10}" ]; then
    echo "Confirmation did not match. Aborted."
    exit 1
  fi
}

run_transfer() {
  local new_owner="$1" dry="$2"
  shift 2
  local objects=("$@")
  local active list="" id

  validate_address "${new_owner}"
  active=$(sui client active-address)

  if [ "${new_owner}" = "${active}" ]; then
    echo "Error: new owner is the active address. Nothing to do."
    exit 1
  fi

  for id in "${objects[@]}"; do
    assert_held_by_active "object" "${id}" "${active}"
    list="${list:+${list}, }@${id}"
  done

  echo "From : ${active}"
  echo "To   : ${new_owner}"
  echo "Objs : ${objects[*]}"

  if [ "${dry}" = "--dry-run" ]; then
    echo "--- DRY RUN (nothing will be sent) ---"
    sui client ptb \
      --transfer-objects "[${list}]" "@${new_owner}" \
      --gas-budget "${GAS_BUDGET}" \
      --dry-run
    return
  fi

  echo "WARNING: this is irreversible."
  confirm "${new_owner}"

  # Single PTB so all objects move atomically
  sui client ptb \
    --transfer-objects "[${list}]" "@${new_owner}" \
    --gas-budget "${GAS_BUDGET}"
}

# --- Commands --------------------------------------------------------------

case "${COMMAND}" in
  "check")
    echo "=== Current Ownership ==="
    echo "AdminCap   ${ADMIN_CAP_ID}"
    echo "  owner:   $(owner_of "${ADMIN_CAP_ID}")"
    echo "UpgradeCap ${UPGRADE_CAP_ID}"
    echo "  owner:   $(owner_of "${UPGRADE_CAP_ID}")"
    echo "Active address: $(sui client active-address)"
    ;;

  "transfer-all")
    NEW_OWNER=${2:?"Usage: ./transfer-ownership.sh transfer-all <new_owner_address> [--dry-run]"}
    run_transfer "${NEW_OWNER}" "${3:-}" "${ADMIN_CAP_ID}" "${UPGRADE_CAP_ID}"
    ;;

  "transfer-admin")
    NEW_OWNER=${2:?"Usage: ./transfer-ownership.sh transfer-admin <new_owner_address> [--dry-run]"}
    run_transfer "${NEW_OWNER}" "${3:-}" "${ADMIN_CAP_ID}"
    ;;

  "transfer-upgrade")
    NEW_OWNER=${2:?"Usage: ./transfer-ownership.sh transfer-upgrade <new_owner_address> [--dry-run]"}
    run_transfer "${NEW_OWNER}" "${3:-}" "${UPGRADE_CAP_ID}"
    ;;

  "verify")
    EXPECTED=${2:?"Usage: ./transfer-ownership.sh verify <expected_owner_address>"}
    validate_address "${EXPECTED}"
    OK=1
    for pair in "AdminCap:${ADMIN_CAP_ID}" "UpgradeCap:${UPGRADE_CAP_ID}"; do
      LABEL="${pair%%:*}"
      ID="${pair#*:}"
      OWNER=$(owner_of "${ID}")
      if [ "${OWNER}" = "${EXPECTED}" ]; then
        echo "OK   ${LABEL} owned by ${EXPECTED}"
      else
        echo "FAIL ${LABEL} owned by ${OWNER}"
        OK=0
      fi
    done
    [ "${OK}" -eq 1 ] || exit 1
    ;;

  *)
    echo "cNGN Ownership Transfer"
    echo "Available commands:"
    echo "  check"
    echo "  transfer-all <new_owner> [--dry-run]       (AdminCap + UpgradeCap, atomic)"
    echo "  transfer-admin <new_owner> [--dry-run]"
    echo "  transfer-upgrade <new_owner> [--dry-run]"
    echo "  verify <expected_owner>"
    ;;
esac