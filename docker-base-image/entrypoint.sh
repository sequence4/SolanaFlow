#!/bin/bash
# keep the incremental cache – Turbo/SWC will invalidate stale chunks
# (wipe manually only when you hit a corrupted build)

# ────────────────────────────────────────────────────────────────────
# Inject Anchor's keypair & derived Program ID into the runtime env
# so the client always deploys/upgrades the SAME on‑chain address.
# ────────────────────────────────────────────────────────────────────
KEYPAIR_PATH="$(find /usr/src/target/deploy -maxdepth 1 -name '*-keypair.json' | head -n 1)"
if [ -f "$KEYPAIR_PATH" ]; then
  # 64‑byte secret key → env
  export NEXT_PUBLIC_PROGRAM_SECRET_KEY="$(cat "$KEYPAIR_PATH")"

  # Derive pubkey deterministically with a one‑liner
  PROGRAM_ID="$(node -e "const k=require('$KEYPAIR_PATH');const{PublicKey}=require('@solana/web3.js');console.log(new PublicKey(k).toBase58())")"
  export NEXT_PUBLIC_PROGRAM_ID="$PROGRAM_ID"

  echo "🪄  Injected Program ID $PROGRAM_ID from $(basename "$KEYPAIR_PATH")"
fi

exec "$@" 