#!/bin/bash
set -euo pipefail

cd /usr/src/token-minting-program-085dca66

echo "===== Running anchor build ====="
anchor build
