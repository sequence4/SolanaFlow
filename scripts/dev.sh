#!/usr/bin/env bash
#
# Bring up Traefik, the dapp container *and* Postgres,
# then start BOTH the Node back-end (server) **and** the
# client front-end in watch mode.
#
# Usage:   ./scripts/dev.sh         (from repo root)
# ---------------------------------------------------
set -euo pipefail

# ─── Configurable knobs ─────────────────────────────
export APP_ID=${APP_ID:-demo}
export APP_BASE_PATH="/dapp/${APP_ID}"
export FORCE_REMOTE_DOCKER=0
export SF_DEV_SERVER=1

# ─── Docker stack ───────────────────────────────────
unset DOCKER_HOST DOCKER_TLS_VERIFY DOCKER_CERT_PATH DOCKER_CLI_EXPERIMENTAL

docker compose              \
  -f compose.yaml           \
  -f docker-compose.db.yaml \
  down --remove-orphans

docker compose              \
  -f compose.yaml           \
  -f docker-compose.db.yaml \
  pull

docker compose              \
  -f compose.yaml           \
  -f docker-compose.db.yaml \
  up -d

# ─── GitHub Container Registry login (NOP if already logged in) ──
echo "${GHCR_PAT:-unset}" | \
  docker login ghcr.io -u "${GHCR_USER:-unset}" --password-stdin 2>/dev/null || true

# ─── Kill any lingering dev processes so we don’t double-spawn ───
pkill -f 'src/app.ts'  2>/dev/null || true
pkill -f 'next dev'    2>/dev/null || true

# ─── Source server/.env if it exists ─────────────────────────────
[[ -f server/.env ]] && source server/.env

# ─── Launch back-end & front-end concurrently ───────────────────
echo "▶️  Starting server watch task..."
pnpm --filter server dev &          # background -- logs still stream

echo "▶️  Starting client front-end..."
pnpm --filter client dev &          # background -- logs still stream

# Wait for either process to exit (Ctrl-C to stop both)
wait -n
