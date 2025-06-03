-- Queue for containers to be deleted manually / by cron
CREATE TABLE IF NOT EXISTS cleanup_queue (
  container_name TEXT PRIMARY KEY,
  project_id     UUID NOT NULL,
  queued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleanup_by_project
           ON cleanup_queue (project_id); 