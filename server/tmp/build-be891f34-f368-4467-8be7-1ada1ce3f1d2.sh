#!/bin/bash
set -euo pipefail

cd /usr/src/test-ab6ab050

echo "===== Running anchor build ====="
anchor build
