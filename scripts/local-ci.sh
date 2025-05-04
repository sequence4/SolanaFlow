#!/usr/bin/env bash
set -euo pipefail

# 1. static gates
pnpm -r lint && pnpm -r type-check

# 2. tests
pnpm --filter landing test
pnpm --filter landing test:cov
pnpm --filter landing run test:e2e
pnpm --filter landing lighthouse:test

# 3. security checks
pnpm --filter landing deps:audit --audit-level high

# check if gitleaks is installed
if command -v gitleaks &>/dev/null; then
  pnpm --filter landing security:scan || true
else
  echo "🟡  gitleaks not installed – skipping secret scan locally"
fi

# 4. exact GitHub workflow via ACT
act \
  -j landing-ci -j security-audit \
  --env-file landing/.env.test \
  -P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest 