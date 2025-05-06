#!/usr/bin/env bash
set -euo pipefail
psql "$DATABASE_URL" -c \
  "INSERT INTO waitlist (email) VALUES ('smoke@test.io');"
if psql "$DATABASE_URL" -c \
   "DELETE FROM waitlist WHERE email='smoke@test.io';" 2>&1 | grep -q 'permission denied'; then
  echo "✅ writer role is INSERT-only"
else
  echo "❌ writer role has excess perms" && exit 1
fi 