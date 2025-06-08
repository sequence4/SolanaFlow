#!/bin/bash

# Load environment variables
if [ -f ../.env.development ]; then
  export $(grep -v '^#' ../.env.development | xargs)
  echo "Loaded environment from ../.env.development"
else 
  echo "Warning: .env.development file not found"
fi

# Run the SQL script to drop org_id column
if [ -n "$DATABASE_URL" ]; then
  echo "Running SQL to drop org_id column..."
  psql $DATABASE_URL -f drop-org-id.sql
  echo "Done."
else
  echo "Error: DATABASE_URL environment variable not set"
  exit 1
fi 