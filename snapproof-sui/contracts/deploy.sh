#!/bin/bash
# Deploy SnapProof Move contract to Sui testnet
#
# Prerequisites:
#   1. Install Sui CLI: https://docs.sui.io/build/install
#   2. Set up wallet: sui client new-address ed25519
#   3. Switch to testnet: sui client switch --env testnet
#   4. Get testnet tokens: sui client faucet
#
# Usage:
#   cd contracts
#   chmod +x deploy.sh
#   ./deploy.sh

set -e

echo "Building SnapProof contract..."
sui move build

echo ""
echo "Deploying to testnet..."
RESULT=$(sui client publish --gas-budget 100000000 --json 2>&1)

echo ""
echo "Raw result:"
echo "$RESULT"

# Extract package ID from the result
PACKAGE_ID=$(echo "$RESULT" | grep -o '"packageId":"0x[a-f0-9]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PACKAGE_ID" ]; then
  echo ""
  echo "=========================================="
  echo "  DEPLOYMENT SUCCESSFUL!"
  echo "=========================================="
  echo ""
  echo "  Package ID: $PACKAGE_ID"
  echo ""
  echo "  Next steps:"
  echo "  1. Update mobile/src/config.ts:"
  echo "     PROOF_PACKAGE_ID = \"$PACKAGE_ID\""
  echo ""
  echo "  2. Update .env:"
  echo "     PROOF_PACKAGE_ID=$PACKAGE_ID"
  echo ""
  echo "  View on explorer:"
  echo "  https://suiscan.xyz/testnet/object/$PACKAGE_ID"
  echo "=========================================="
else
  echo ""
  echo "Could not extract package ID from result."
  echo "Check the output above and update PROOF_PACKAGE_ID manually."
fi
