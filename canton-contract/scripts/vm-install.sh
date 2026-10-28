#!/usr/bin/env bash
# ==============================================================================
# cNGN Canton — VM Deployment & Setup Script (Ubuntu/Debian)
# ==============================================================================
# Usage:
#   chmod +x scripts/vm-install.sh
#   ./scripts/vm-install.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "============================================================"
echo "  Deploying cNGN Canton on Linux VM"
echo "============================================================"

# 1. Install System Dependencies
echo "==> [1/5] Checking and installing system dependencies..."
if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y
    sudo apt-get install -y openjdk-17-jre-headless curl git make netcat-openbsd jq
elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y java-17-openjdk curl git make nc jq
fi

# 2. Install Daml SDK (v2.10.4)
echo "==> [2/5] Checking Daml SDK..."
export PATH="$HOME/.daml/bin:$PATH"

if ! command -v daml >/dev/null 2>&1; then
    echo "Installing Daml SDK 2.10.4..."
    curl -sSL https://get.daml.com | sh -s 2.10.4
    export PATH="$HOME/.daml/bin:$PATH"
    echo 'export PATH="$HOME/.daml/bin:$PATH"' >> ~/.bashrc
    echo 'export PATH="$HOME/.daml/bin:$PATH"' >> ~/.profile
else
    echo "Daml SDK already installed: $(daml version)"
fi

# 3. Build the DAR Package
echo "==> [3/5] Building cNGN DAR package..."
cd "${PROJECT_ROOT}"
daml build

# 4. Deploy Ledger & Contracts
echo "==> [4/5] Starting Canton Ledger and initializing contracts..."
make deploy

# 5. Output Verification
echo "==> [5/5] Checking ledger status..."
make list-parties

echo "============================================================"
echo "  ✓ Canton cNGN Deployment Successful!"
echo "  Ledger API listening on: localhost:6865"
echo "============================================================"
