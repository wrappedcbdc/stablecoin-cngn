#!/usr/bin/env bash
# ==============================================================================
# cNGN on Sui — Deployment & Publishing Script
# ==============================================================================
# Publishes the cNGN Move package to the connected Sui network (testnet/mainnet/devnet),
# parses generated object IDs (Package, AdminCap, AdminRegistry, CoinState, UpgradeCap),
# and saves them to deployment.json and .env.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_JSON="${PACKAGE_DIR}/deployment.json"
OUTPUT_ENV="${PACKAGE_DIR}/.env"

echo "=== Building cNGN Move Package ==="
cd "${PACKAGE_DIR}"
sui move build

echo "=== Publishing Package to Active Sui Network ==="
GAS_BUDGET=100000000 # 0.1 SUI

PUBLISH_RES=$(sui client publish --gas-budget "${GAS_BUDGET}" --json "${PACKAGE_DIR}")

echo "=== Parsing Deployment Outputs ==="

# Extract Package ID
PACKAGE_ID=$(echo "${PUBLISH_RES}" | jq -r '.objectChanges[] | select(.type == "published") | .packageId')

# Extract UpgradeCap ID
UPGRADE_CAP_ID=$(echo "${PUBLISH_RES}" | jq -r '.objectChanges[] | select(.objectType | contains("::package::UpgradeCap")) | .objectId')

# Extract AdminCap ID
ADMIN_CAP_ID=$(echo "${PUBLISH_RES}" | jq -r '.objectChanges[] | select(.objectType | contains("::admin::AdminCap")) | .objectId')

# Extract AdminRegistry Shared Object ID
ADMIN_REGISTRY_ID=$(echo "${PUBLISH_RES}" | jq -r '.objectChanges[] | select(.objectType | contains("::admin::AdminRegistry")) | .objectId')

# Extract CoinState Shared Object ID
COIN_STATE_ID=$(echo "${PUBLISH_RES}" | jq -r '.objectChanges[] | select(.objectType | contains("::cngn::CoinState")) | .objectId')

# Extract CoinMetadata Object ID
COIN_METADATA_ID=$(echo "${PUBLISH_RES}" | jq -r '.objectChanges[] | select(.objectType | contains("::coin::CoinMetadata")) | .objectId')

# Standard DenyList shared object address on Sui (0x403)
DENY_LIST_ID="0x0000000000000000000000000000000000000000000000000000000000000403"

echo "---------------------------------------------------------"
echo "Package ID:        ${PACKAGE_ID}"
echo "UpgradeCap ID:     ${UPGRADE_CAP_ID}"
echo "AdminCap ID:       ${ADMIN_CAP_ID}"
echo "AdminRegistry ID:  ${ADMIN_REGISTRY_ID}"
echo "CoinState ID:      ${COIN_STATE_ID}"
echo "CoinMetadata ID:   ${COIN_METADATA_ID}"
echo "DenyList ID:       ${DENY_LIST_ID}"
echo "---------------------------------------------------------"

# Write deployment.json
cat <<EOF > "${OUTPUT_JSON}"
{
  "packageId": "${PACKAGE_ID}",
  "upgradeCapId": "${UPGRADE_CAP_ID}",
  "adminCapId": "${ADMIN_CAP_ID}",
  "adminRegistryId": "${ADMIN_REGISTRY_ID}",
  "coinStateId": "${COIN_STATE_ID}",
  "coinMetadataId": "${COIN_METADATA_ID}",
  "denyListId": "${DENY_LIST_ID}"
}
EOF

# Write .env
cat <<EOF > "${OUTPUT_ENV}"
SUI_PACKAGE_ID=${PACKAGE_ID}
SUI_UPGRADE_CAP_ID=${UPGRADE_CAP_ID}
SUI_ADMIN_CAP_ID=${ADMIN_CAP_ID}
SUI_ADMIN_REGISTRY_ID=${ADMIN_REGISTRY_ID}
SUI_COIN_STATE_ID=${COIN_STATE_ID}
SUI_COIN_METADATA_ID=${COIN_METADATA_ID}
SUI_DENY_LIST_ID=${DENY_LIST_ID}
EOF

echo "✓ Deployment info written to:"
echo "  - ${OUTPUT_JSON}"
echo "  - ${OUTPUT_ENV}"
