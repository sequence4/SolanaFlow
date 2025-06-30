# scripts/run_local_migrations.sh
#!/usr/bin/env bash
set -euo pipefail

DB_URL=${DATABASE_URL:-"postgres://postgres:JNQ3hpz8yet-ubk-nja@localhost:5432/solanaflow_pg"}

FILES=(
  "migration/schema.sql"
  "migrations/20240614_add_container_name.sql"
  "db/migrations/20250615_add_task_type.sql"
)

for f in "${FILES[@]}"; do
  echo "🔹  Running ${f}"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "✅  All migrations applied"
