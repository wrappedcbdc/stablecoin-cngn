#!/usr/bin/env bash
# ==============================================================================
# cNGN on Sui — CLI Interaction Script (Sui Move 2024 Compliant)
# ==============================================================================
# Usage:
#   ./interact.sh grant-mint <minter_address> <amount>
#   ./interact.sh mint <amount> <recipient_address>
#   ./interact.sh burn <coin_object_id>
#   ./interact.sh pause
#   ./interact.sh unpause
#   ./interact.sh add-blacklist <user_address>
#   ./interact.sh remove-blacklist <user_address>
#   ./interact.sh add-forwarder <forwarder_address>
#   ./interact.sh remove-forwarder <forwarder_address>
#   ./interact.sh add-trusted-contract <contract_address>
#   ./interact.sh remove-trusted-contract <contract_address>
#   ./interact.sh query-state
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${PACKAGE_DIR}/deployment.json"

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "Error: deployment.json not found! Run ./deploy.sh first."
  exit 1
fi

PACKAGE_ID=$(jq -r '.packageId' "${CONFIG_FILE}")
ADMIN_CAP_ID=$(jq -r '.adminCapId' "${CONFIG_FILE}")
ADMIN_REGISTRY_ID=$(jq -r '.adminRegistryId' "${CONFIG_FILE}")
COIN_STATE_ID=$(jq -r '.coinStateId' "${CONFIG_FILE}")
DENY_LIST_ID=$(jq -r '.denyListId' "${CONFIG_FILE}")
GAS_BUDGET=50000000

COMMAND=${1:-"help"}

case "${COMMAND}" in
  # --- Admin Mint Grant Management (Object first, Cap second) ---
  "grant-mint")
    MINTER=${2:?"Usage: ./interact.sh grant-mint <minter_address> <amount>"}
    AMOUNT=${3:?"Usage: ./interact.sh grant-mint <minter_address> <amount>"}
    echo "Granting mint permission to ${MINTER} for amount ${AMOUNT}..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "admin" \
      --function "grant_mint_permission" \
      --args "${ADMIN_REGISTRY_ID}" "${ADMIN_CAP_ID}" "${MINTER}" "${AMOUNT}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  "revoke-mint")
    MINTER=${2:?"Usage: ./interact.sh revoke-mint <minter_address>"}
    echo "Revoking mint permission from ${MINTER}..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "admin" \
      --function "revoke_mint_permission" \
      --args "${ADMIN_REGISTRY_ID}" "${ADMIN_CAP_ID}" "${MINTER}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  # --- Token Minting & Burning ---
  "mint")
    AMOUNT=${2:?"Usage: ./interact.sh mint <amount> <recipient_address>"}
    RECIPIENT=${3:?"Usage: ./interact.sh mint <amount> <recipient_address>"}
    echo "Minting ${AMOUNT} cNGN to ${RECIPIENT}..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "cngn" \
      --function "mint" \
      --args "${COIN_STATE_ID}" "${ADMIN_REGISTRY_ID}" "${DENY_LIST_ID}" "${AMOUNT}" "${RECIPIENT}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  "burn")
    COIN_ID=${2:?"Usage: ./interact.sh burn <coin_object_id>"}
    echo "Burning coin ${COIN_ID}..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "cngn" \
      --function "burn_by_user" \
      --args "${COIN_STATE_ID}" "${COIN_ID}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  # --- Emergency Circuit Breakers (Pause / Unpause: Object first, Cap second) ---
  "pause")
    echo "Pausing cNGN secondary transfers..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "cngn" \
      --function "pause" \
      --args "${COIN_STATE_ID}" "${ADMIN_CAP_ID}" "${DENY_LIST_ID}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  "unpause")
    echo "Unpausing cNGN secondary transfers..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "cngn" \
      --function "unpause" \
      --args "${COIN_STATE_ID}" "${ADMIN_CAP_ID}" "${DENY_LIST_ID}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  # --- Blacklist / Sanctions Controls (Object first, Cap second) ---
  "add-blacklist")
    USER=${2:?"Usage: ./interact.sh add-blacklist <user_address>"}
    echo "Adding ${USER} to DenyList..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "cngn" \
      --function "add_black_list" \
      --args "${COIN_STATE_ID}" "${ADMIN_CAP_ID}" "${DENY_LIST_ID}" "${USER}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  "remove-blacklist")
    USER=${2:?"Usage: ./interact.sh remove-blacklist <user_address>"}
    echo "Removing ${USER} from DenyList..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "cngn" \
      --function "remove_black_list" \
      --args "${COIN_STATE_ID}" "${ADMIN_CAP_ID}" "${DENY_LIST_ID}" "${USER}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  # --- Forwarder Whitelist Management (Object first, Cap second) ---
  "add-forwarder")
    FORWARDER=${2:?"Usage: ./interact.sh add-forwarder <forwarder_address>"}
    echo "Adding forwarder ${FORWARDER}..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "admin" \
      --function "add_can_forward" \
      --args "${ADMIN_REGISTRY_ID}" "${ADMIN_CAP_ID}" "${FORWARDER}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  "remove-forwarder")
    FORWARDER=${2:?"Usage: ./interact.sh remove-forwarder <forwarder_address>"}
    echo "Removing forwarder ${FORWARDER}..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "admin" \
      --function "remove_can_forward" \
      --args "${ADMIN_REGISTRY_ID}" "${ADMIN_CAP_ID}" "${FORWARDER}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  # --- Trusted Contract Management (Object first, Cap second) ---
  "add-trusted-contract")
    CONTRACT=${2:?"Usage: ./interact.sh add-trusted-contract <contract_address>"}
    echo "Adding trusted contract ${CONTRACT}..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "admin" \
      --function "add_trusted_contract" \
      --args "${ADMIN_REGISTRY_ID}" "${ADMIN_CAP_ID}" "${CONTRACT}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  "remove-trusted-contract")
    CONTRACT=${2:?"Usage: ./interact.sh remove-trusted-contract <contract_address>"}
    echo "Removing trusted contract ${CONTRACT}..."
    sui client call \
      --package "${PACKAGE_ID}" \
      --module "admin" \
      --function "remove_trusted_contract" \
      --args "${ADMIN_REGISTRY_ID}" "${ADMIN_CAP_ID}" "${CONTRACT}" \
      --gas-budget "${GAS_BUDGET}"
    ;;

  # --- Views & State Queries ---
  "query-state")
    echo "=== Fetching Shared State Objects ==="
    sui client object "${COIN_STATE_ID}"
    sui client object "${ADMIN_REGISTRY_ID}"
    ;;

  *)
    echo "cNGN CLI Manager (Move 2024 Edition)"
    echo "Available commands:"
    echo "  grant-mint <minter> <amount>"
    echo "  revoke-mint <minter>"
    echo "  mint <amount> <recipient>"
    echo "  burn <coin_id>"
    echo "  pause"
    echo "  unpause"
    echo "  add-blacklist <user>"
    echo "  remove-blacklist <user>"
    echo "  add-forwarder <forwarder>"
    echo "  remove-forwarder <forwarder>"
    echo "  add-trusted-contract <contract>"
    echo "  remove-trusted-contract <contract>"
    echo "  query-state"
    ;;
esac
