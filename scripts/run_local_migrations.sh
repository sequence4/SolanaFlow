#!/usr/bin/env bash
set -euo pipefail

# --- SETTINGS ---------------------------------------------------------------
COMPOSE_FILE="docker-compose.db.yaml"   # compose file to target
SERVICE="db"                            # service name inside the YAML
DB="solanaflow_dev"                      # database name
USER="postgres"                         # DB superuser

FILES=(
  "migration/schema.sql"
  "migrations/20240614_add_container_name.sql"
  "db/migrations/20250615_add_task_type.sql"
)
# ---------------------------------------------------------------------------

for f in "${FILES[@]}"; do
  echo "🔹  Running ${f}"
  # stream the file over STDIN; -f - tells psql to read from STDIN
  docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
    psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -f - < "$f"
done

echo "✅  All migrations applied"
