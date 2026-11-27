#!/usr/bin/env bash
# ==============================================================================
# cNGN on Sui — Package Upgrade Script
# ==============================================================================
# Upgrades the cNGN Move package on the active Sui network using the UpgradeCap,
# updates the package history, and syncs deployment.json & .env.
#
# Usage:
#   ./upgrade.sh
#   make upgrade
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${PACKAGE_DIR}/deployment.json"
ENV_FILE="${PACKAGE_DIR}/.env"

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "Error: deployment.json not found in ${PACKAGE_DIR}! Run 'make deploy' first."
  exit 1
fi

UPGRADE_CAP_ID=$(jq -r '.upgradeCapId // empty' "${CONFIG_FILE}")
PREVIOUS_PACKAGE_ID=$(jq -r '.packageId // empty' "${CONFIG_FILE}")
GAS_BUDGET=150000000

if [ -z "${UPGRADE_CAP_ID}" ]; then
  echo "Error: upgradeCapId not found in deployment.json!"
  exit 1
fi

echo "============================================================"
echo "  Upgrading cNGN Move Package"
echo "============================================================"
echo "Current Package ID:   ${PREVIOUS_PACKAGE_ID}"
echo "Using UpgradeCap ID:  ${UPGRADE_CAP_ID}"
echo "Gas Budget:           ${GAS_BUDGET}"
echo "------------------------------------------------------------"

cd "${PACKAGE_DIR}"

echo "=== [1/3] Building Move bytecode for upgrade ==="
sui move build

echo "=== [2/3] Publishing bytecode upgrade via UpgradeCap ==="
UPGRADE_RES=$(sui client upgrade --upgrade-capability "${UPGRADE_CAP_ID}" --gas-budget "${GAS_BUDGET}" --json "${PACKAGE_DIR}")

NEW_PACKAGE_ID=$(echo "${UPGRADE_RES}" | jq -r '.objectChanges[] | select(.type == "published") | .packageId')

if [ -z "${NEW_PACKAGE_ID}" ] || [ "${NEW_PACKAGE_ID}" == "null" ]; then
  echo "Error: Failed to retrieve new Package ID from upgrade transaction."
  echo "${UPGRADE_RES}"
  exit 1
fi

echo "=== [3/3] Updating deployment configuration ==="
echo "✓ Upgrade successful!"
echo "New Package ID: ${NEW_PACKAGE_ID}"

# Update deployment.json with new Package ID and record previous version in packageHistory
jq --arg newPkg "${NEW_PACKAGE_ID}" --arg oldPkg "${PREVIOUS_PACKAGE_ID}" '
  .packageId = $newPkg |
  .packageHistory = ((.packageHistory // []) + [$oldPkg] | unique)
' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"

# Update .env
if [ -f "${ENV_FILE}" ]; then
  sed -i.bak "s/SUI_PACKAGE_ID=.*/SUI_PACKAGE_ID=${NEW_PACKAGE_ID}/g" "${ENV_FILE}" && rm -f "${ENV_FILE}.bak"
fi

echo ""
echo "============================================================"
echo "  Upgrade Complete!"
echo "============================================================"
echo "  Previous Package ID: ${PREVIOUS_PACKAGE_ID}"
echo "  Active Package ID:   ${NEW_PACKAGE_ID}"
echo "  Synced to:           deployment.json & .env"
echo "============================================================"
