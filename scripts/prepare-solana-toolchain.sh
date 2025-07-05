#!/usr/bin/env bash
# scripts/prepare-solana-toolchain.sh
set -euo pipefail

# Link the stable toolchain as "solana" for Anchor compatibility
RUSTUP_HOME=$(rustup show home)
TOOLCHAIN_DIR=$(rustup default | cut -d ' ' -f1)
if ! rustup toolchain list | grep -q '^solana'; then
    rustup toolchain link solana "$RUSTUP_HOME/toolchains/$TOOLCHAIN_DIR"
fi
export RUSTUP_TOOLCHAIN=solana

# Ensure the correct target & linker components exist
rustup target add bpfel-unknown-unknown   --toolchain stable
rustup target add sbf-solana-solana       --toolchain stable
rustup component add llvm-tools-preview   --toolchain stable

# Fail fast if the linker is still missing
command -v rust-lld >/dev/null || {
  echo "❌ rust-lld not found after component install"; exit 13;
}

echo "✅ Solana tool‑chain ready ($(rustc -V))" 

