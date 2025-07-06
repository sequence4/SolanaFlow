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
    apt-get install -y --no-install-recommends ca-certificates curl wget
  update-ca-certificates
fi

# ---------------------------------------------------------------------------
# NEW: install Solana CLI → grab its pre‑built Rust‑BPF tool‑chain
# ---------------------------------------------------------------------------

# 1. Download & run Solana installer
#    * Prefer wget (GnuTLS avoids the OpenSSL EOF bug).
#    * Fall back to curl with --tlsv1.2 --no-alpn if wget is not present.
set +e
if command -v wget >/dev/null 2>&1; then
  wget -qO- --inet4-only --https-only --secure-protocol=TLSv1_2 \
       --retry-connrefused --waitretry=2 --tries=5 \
       https://release.solana.com/stable/install | bash -s -- -y
  EXIT_CODE=$?
else
  curl -4 --retry 5 --retry-delay 2 --retry-connrefused \
       --fail --location --proto '=https' --tlsv1.2 --no-alpn \
       https://release.solana.com/stable/install | bash -s -- -y
  EXIT_CODE=$?
fi
set -e
if [ $EXIT_CODE -ne 0 ]; then
  echo "❌  Failed to download Solana CLI (curl/wget exit $EXIT_CODE)" >&2
  exit $EXIT_CODE
fi
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

