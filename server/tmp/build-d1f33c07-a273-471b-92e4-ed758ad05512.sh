#!/bin/bash
set -euo pipefail

cd /usr/src/56gr-6ecef548

echo "===== Running anchor build ====="
anchor build

# ── determine the correct target directory and find the first .so file ──
SO_DIR="${CARGO_TARGET_DIR:-target}/deploy"
SO_PATH=$(find "$SO_DIR" -maxdepth 1 -name '*.so' | head -n 1)

if [[ -z "$SO_PATH" ]]; then
  echo "BUILD_FAILURE: no .so in $SO_DIR"
  exit 1
fi

echo "BUILD_SUCCESS: $SO_PATH"
