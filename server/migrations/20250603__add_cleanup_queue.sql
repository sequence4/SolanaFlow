DROP TABLE IF EXISTS cleanup_queue;

CREATE TABLE cleanup_queue (
  container_name TEXT PRIMARY KEY,
  project_id     UUID NOT NULL,
  queued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep a loose index for look-ups
CREATE INDEX idx_cleanup_by_project ON cleanup_queue (project_id); 