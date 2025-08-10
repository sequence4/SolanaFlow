#!/usr/bin/env bash
#
# Bring up Traefik, the dapp container *and* Postgres,
# then start BOTH the Node back-end (server) **and** the
# client front-end in watch mode.
#
# Usage:   ./scripts/dev.sh         (from repo root)
# ---------------------------------------------------
set -euo pipefail

# NOTE: This script enforces an isolated Docker config to avoid credsStore/GPG.

# ─── Configurable knobs ─────────────────────────────
export APP_ID=${APP_ID:-demo}
export APP_BASE_PATH="/dapp/${APP_ID}"
export FORCE_REMOTE_DOCKER=0
export SF_DEV_SERVER=1
export REGISTRY_DOMAIN=${REGISTRY_DOMAIN:-ghcr.io}

# ─── Use a repo-local Docker config (no credsStore/gpg) ──────────────────────
# This prevents the global helper (e.g. "desktop.exe" / gpg) from being used.
REPO_DOCKER_CONFIG="$(cd "$(dirname "$0")/.." && pwd)/scripts/docker-config"
export DOCKER_CONFIG="$REPO_DOCKER_CONFIG"
mkdir -p "$DOCKER_CONFIG"
if [ ! -f "$DOCKER_CONFIG/config.json" ]; then
  printf '{"auths":{}}\n' > "$DOCKER_CONFIG/config.json"
fi

# Wrapper that forces all docker commands to use the isolated config.
# We pick the docker binary now; if we later detect Windows docker.exe we’ll
# update DOCKER_BIN before using DOCKER().
DOCKER_BIN="$(command -v docker)"
DOCKER () {
  "$DOCKER_BIN" --config "$DOCKER_CONFIG" "$@"
}
export DOCKER_CONFIG

# Show which config is used (helps debugging)
echo "🔧 Using DOCKER_CONFIG: $DOCKER_CONFIG"

# ─── Clear stale Windows → WSL port-proxy rules ────────────────────────────────
# When Windows leaves a v4-to-v4 port-proxy entry after the previous run,
# the next "localhost" request can hang until you `wsl --shutdown`.  Deleting the
# proxy rules for the ports we're about to bind avoids that pain.
#
# • Edit PORTPROXY_PORTS if your stacks use different ports.
# • Runs best-effort: ignores errors and carries on if netsh isn't present.
#
PORTPROXY_PORTS="${PORTPROXY_PORTS:-3000 4000 5173}"
for p in $PORTPROXY_PORTS; do
  powershell.exe -NoProfile -NonInteractive -Command \
    "netsh interface portproxy delete v4tov4 listenport=$p listenaddress=0.0.0.0" \
    >/dev/null 2>&1 || true
done

# ─── Ensure Docker daemon & CLI are usable ───────────────────────
# 1) If `docker info` works → nothing to do.
# 2) Otherwise try to start the Windows service that backs Docker Desktop.
# 3) If the UNIX shim is busted, fall back to the real docker.exe binary (and keep our --config).
# 4) Wait up to 30 s; bail if the engine never comes up.

if ! DOCKER info >/dev/null 2>&1; then
  echo "🐳  Docker daemon not responding — attempting auto-start…"

  # Start Docker Desktop's service (no error if already running)
  powershell.exe -NoProfile -NonInteractive -Command \
    "Start-Service -Name com.docker.service" \
    >/dev/null 2>&1 || true   # 📚 MS docs & user reports

  # If the shim at /usr/local/bin/docker is an EIO symlink, select real docker.exe
  DOCKER_WIN="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"  # default path
  if [ -x "$DOCKER_WIN" ]; then
    DOCKER_BIN="$DOCKER_WIN"
  fi

  # Wait up to 30 s for the daemon
  for _ in {1..30}; do
    if DOCKER info >/dev/null 2>&1; then
      echo "✅  Docker daemon is up."
      break
    fi
    sleep 1
  done

  # Fail gracefully if still dead
  if ! DOCKER info >/dev/null 2>&1; then
    echo "❌  Docker still unavailable. Please open Docker Desktop manually."
    exit 1
  fi
fi

# ─── Auth to private registry BEFORE any pull ────────────────────────────────
# Require GHCR credentials when images are private.
if [ -n "${GHCR_PAT:-}" ] && [ "${GHCR_PAT}" != "unset" ]; then
  echo "🔐 Logging in to ${REGISTRY_DOMAIN} (scoped to repo config)…"
  if ! echo "${GHCR_PAT}" | DOCKER login "${REGISTRY_DOMAIN}" \
        -u "${GHCR_USER:-github}" --password-stdin 1>/dev/null ; then
    echo "❌  Login to ${REGISTRY_DOMAIN} failed. Check GHCR_USER / GHCR_PAT."
    exit 1
  fi
else
  echo "❗ Private images expected but GHCR_PAT is not set."
  echo "   Export GHCR_USER and GHCR_PAT (classic PAT with 'read:packages') and re-run:"
  echo "     export GHCR_USER=<your_github_username>"
  echo "     export GHCR_PAT=<your_pat_with_read_packages>"
  echo "   Aborting before docker compose pull to avoid gpg/pinentry."
  exit 1
fi

# ─── Docker stack ───────────────────────────────────
unset DOCKER_HOST DOCKER_TLS_VERIFY DOCKER_CERT_PATH DOCKER_CLI_EXPERIMENTAL

DOCKER compose              \
  -f compose.yaml           \
  -f docker-compose.db.yaml \
  down --remove-orphans

DOCKER compose              \
  -f compose.yaml           \
  -f docker-compose.db.yaml \
  pull

DOCKER compose              \
  -f compose.yaml           \
  -f docker-compose.db.yaml \
  up -d

# (login already completed above)

# ─── Kill any lingering dev processes so we don't double-spawn ───
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
