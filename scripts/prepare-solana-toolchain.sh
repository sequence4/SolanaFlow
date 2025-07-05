#!/usr/bin/env bash
# scripts/prepare-solana-toolchain.sh
set -euo pipefail

# Always use the tool‑chain installed by the base image
export RUSTUP_TOOLCHAIN=solana

# Ensure the correct target & linker components exist
rustup target add sbf-solana-solana       --toolchain "$RUSTUP_TOOLCHAIN"
rustup component add llvm-tools-preview   --toolchain "$RUSTUP_TOOLCHAIN"

# Fail fast if the linker is still missing
command -v rust-lld >/dev/null || {
  echo "❌ rust-lld not found after component install"; exit 13;
}

echo "✅ Solana tool‑chain ready ($(rustc -V))" 

