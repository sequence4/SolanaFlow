DROP TABLE IF EXISTS cleanup_queue;

CREATE TABLE cleanup_queue (
  container_name TEXT PRIMARY KEY,
  project_id     UUID REFERENCES solanaproject(id) ON DELETE CASCADE,
  queued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cleanup_by_project ON cleanup_queue (project_id);
CREATE INDEX idx_cleanup_queued_at  ON cleanup_queue (queued_at);
