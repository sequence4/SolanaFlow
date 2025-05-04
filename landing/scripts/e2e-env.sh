#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"

src="${root}/.env.test"
dst="${root}/.env.production"

if [[ ! -f "$src" ]]; then
  echo "❌  $src not found – did you forget to commit it?" >&2
  exit 1
fi

trap 'rm -f "$dst"' EXIT
cp "$src" "$dst" 