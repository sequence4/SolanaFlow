CREATE TABLE IF NOT EXISTS cleanup_queue (
  container_name TEXT PRIMARY KEY,
  project_id     UUID NOT NULL,
  queued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep a loose index for look-ups
CREATE INDEX IF NOT EXISTS idx_cleanup_by_project ON cleanup_queue (project_id);

-- Add index on timestamp for efficient range scans
CREATE INDEX IF NOT EXISTS idx_cleanup_queued_at ON cleanup_queue (queued_at); 