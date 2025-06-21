#!/bin/bash
set -euo pipefail

# Get container ID
CONTAINER=$(docker ps -q | head -1)
if [ -z "$CONTAINER" ]; then
  echo "No container found"
  exit 1
fi

# Update the Cargo.toml with optimized release profile
docker exec $CONTAINER bash -c "cat > /usr/src/anchor-template/Cargo.toml" << 'EOF'
[workspace]
members = [
    "programs/*"
]
resolver = "2"

[profile.release]
lto           = "thin"   # uses ~60% less RAM than "fat" LTO
codegen-units = 1        # serial compilation reduces peak memory
opt-level     = "z"      # optional: keeps binaries small, also saves RAM
overflow-checks = true
[profile.release.build-override]
opt-level = 3
incremental = false
codegen-units = 1
EOF

echo "Updated /usr/src/anchor-template/Cargo.toml" 