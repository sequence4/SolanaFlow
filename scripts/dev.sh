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

# ─── Use an isolated Docker config for this session (avoids credsStore/gpg) ──
# We create a temporary DOCKER_CONFIG with no credsStore so docker login writes
# plain auth for this run only (and we remove it at exit).
TMP_DOCKER_CONFIG="$(mktemp -d -t sf-docker-XXXXXX)"
export DOCKER_CONFIG="$TMP_DOCKER_CONFIG"
mkdir -p "$DOCKER_CONFIG"
printf '{"auths":{}}\n' > "$DOCKER_CONFIG/config.json"
cleanup_docker_config () { rm -rf "$TMP_DOCKER_CONFIG"; }
trap cleanup_docker_config EXIT

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
# 3) If the UNIX shim is busted, fall back to the real docker.exe binary.
# 4) Wait up to 30 s; bail if the engine never comes up.

if ! docker info >/dev/null 2>&1; then
  echo "🐳  Docker daemon not responding — attempting auto-start…"

  # Start Docker Desktop's service (no error if already running)
  powershell.exe -NoProfile -NonInteractive -Command \
    "Start-Service -Name com.docker.service" \
    >/dev/null 2>&1 || true   # 📚 MS docs & user reports

  # If the shim at /usr/local/bin/docker is an EIO symlink, alias real docker.exe
  DOCKER_WIN="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"  # default path
  if [ -x "$DOCKER_WIN" ]; then
    alias docker="$DOCKER_WIN"
  fi

  # Wait up to 30 s for the daemon
  for _ in {1..30}; do
    if docker info >/dev/null 2>&1; then
      echo "✅  Docker daemon is up."
      break
    fi
    sleep 1
  done

  # Fail gracefully if still dead
  if ! docker info >/dev/null 2>&1; then
    echo "❌  Docker still unavailable. Please open Docker Desktop manually."
    exit 1
  fi
fi

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

# ─── GitHub Container Registry login (scoped to this isolated config) ──
# Only attempt if a token is provided; otherwise skip quietly.
if [ -n "${GHCR_PAT:-}" ] && [ "${GHCR_PAT}" != "unset" ]; then
  echo "${GHCR_PAT}" | docker login ghcr.io \
    -u "${GHCR_USER:-github}" \
    --password-stdin 2>/dev/null || true
fi

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
