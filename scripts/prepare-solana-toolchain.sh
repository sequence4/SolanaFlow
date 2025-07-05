#!/usr/bin/env bash
set -euo pipefail
export RUSTUP_TOOLCHAIN=solana
# install once – subsequent calls are no‑ops
rustup target   add sbf-solana-solana        --toolchain "$RUSTUP_TOOLCHAIN"
rustup component add llvm-tools-preview      --toolchain "$RUSTUP_TOOLCHAIN"
command -v rust-lld >/dev/null || {
  echo "❌  rust-lld still missing after rustup install"; exit 13; }
# no RUSTFLAGS here – Anchor injects the right ones for SBF v2 