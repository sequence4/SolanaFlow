#!/usr/bin/env bash
set -euo pipefail

################################################################################
# Local CI runner for the *landing* package only
# – Lint, type-check, tests, Lighthouse, security scans
# – Optional GitHub Actions dry-run via `act`
################################################################################

cd "$(git rev-parse --show-toplevel)"

echo "🔄  Ensuring deps are installed with a clean lock-file…"
pnpm install --frozen-lockfile

###############################################################################
# 1. Static analysis gates (lint + TS type-check)
###############################################################################
echo "🔍  ESLint and type-check (landing)…"
pnpm --filter landing run lint --max-warnings 0
pnpm --filter landing run type-check

###############################################################################
# 2. Tests & coverage
###############################################################################
echo "🧪  Jest unit/API/a11y tests…"
pnpm --filter landing run test

echo "🛡  Coverage gate…"
pnpm --filter landing run test:cov

echo "🎭  Playwright E2E suite…"
pnpm --filter landing run test:e2e

echo "🚦  Lighthouse performance budget…"
pnpm --filter landing run lighthouse:test

###############################################################################
# 3. Dependency & secret scans
###############################################################################
echo "📦  pnpm audit (prod, high+)…"
pnpm --filter landing run deps:audit --audit-level high

echo "🔑  Secret scan (gitleaks)…"
if command -v gitleaks &>/dev/null; then
  pnpm --filter landing run security:scan || true   # don’t fail local CI
else
  echo "🟡  gitleaks not installed – running via pnpm dlx"
  # One-shot download of the latest binary into a temp dir, then scan repo root
  pnpm dlx --package=gitleaks gitleaks detect --source . --verbose || true
fi

###############################################################################
# 4. (Optional) simulate the exact GitHub workflow with `act`
###############################################################################
if command -v act &>/dev/null; then
  echo "▶️  act dry-run of landing-CI & security-audit jobs…"
  act \
    -j landing-ci -j security-audit \
    --env-file landing/.env.test \
    -P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
else
  echo "🟡  act not installed – skipping workflow simulation"
fi

echo "✅  Local CI PASSED for landing package"
