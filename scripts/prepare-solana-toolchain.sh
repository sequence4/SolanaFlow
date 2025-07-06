#!/usr/bin/env bash
# scripts/prepare-solana-toolchain.sh
set -euo pipefail

# ---------------------------------------------------------------------------
# Make sure TLS roots & a recent curl exist inside the build container
# ---------------------------------------------------------------------------
if command -v apt-get >/dev/null 2>&1; then
  echo "⏳  Installing ca-certificates…"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive \
    apt-get install -y --no-install-recommends ca-certificates curl
  update-ca-certificates
fi

# ---------------------------------------------------------------------------
# NEW: install Solana CLI → grab its pre‑built Rust‑BPF tool‑chain
# ---------------------------------------------------------------------------

# 1. Install the latest Solana CLI (quiet, non‑interactive, retry TLS hiccups)
curl --retry 5 --retry-delay 2 --retry-connrefused \
     --fail --location --proto '=https' --tlsv1.2 \
     https://release.solana.com/stable/install | bash -s -- -y
# make the CLI visible for the rest of the script
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# 2. Locate the Rust tool‑chain that ships with the BPF SDK
SOLANA_VER=$(solana --version | awk '{print $2}')
BPF_RUST_DIR="$HOME/.local/share/solana/install/releases/${SOLANA_VER}/solana-release/bin/sdk/bpf/dependencies/bpf-tools/rust"

# 3. Link it into rustup so that `cargo +bpf` (and older `+solana`) just work
if [ -d "$BPF_RUST_DIR" ]; then
  rustup toolchain link bpf "$BPF_RUST_DIR"
  if ! rustup toolchain list | grep -q '^solana'; then
      rustup toolchain link solana "$BPF_RUST_DIR"
  fi
else
  echo "❌  Could not locate Solana BPF Rust at $BPF_RUST_DIR" >&2
  exit 1
fi

# 4. Keep host‑stable as default (Anchor always overrides with +bpf anyway)
rustup default stable

echo "✅ Solana tool‑chain ready ($(rustc -V))" 

