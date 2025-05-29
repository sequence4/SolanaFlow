DROP TRIGGER IF EXISTS update_solana_project_last_updated ON "SolanaProject";
DROP TRIGGER IF EXISTS update_task_last_updated           ON "Task";

DROP TRIGGER IF EXISTS update_solana_project_last_updated ON "solanaproject";
DROP TRIGGER IF EXISTS update_task_last_updated           ON "task";

DROP FUNCTION IF EXISTS update_last_updated_column();

DROP TABLE IF EXISTS warm_container_pool           CASCADE;
DROP TABLE IF EXISTS "task"                        CASCADE;
DROP TABLE IF EXISTS "solanaproject"               CASCADE;

DROP TABLE IF EXISTS "Task"                        CASCADE;
DROP TABLE IF EXISTS "SolanaProject"               CASCADE;

CREATE TABLE "solanaproject" (
  id             UUID PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  root_path      TEXT,
  details        JSONB,
  container_name TEXT,
  container_url  TEXT,
  last_updated   TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_solana_project_name ON "solanaproject"(name);

CREATE TABLE "task" (
  id           UUID PRIMARY KEY,
  name         TEXT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  creator_id   UUID,
  result       TEXT,
  last_updated TIMESTAMP,
  project_id   UUID REFERENCES "solanaproject"(id) ON DELETE CASCADE,
  status       VARCHAR(50) CHECK (status IN ('queued','doing','finished',
                                             'succeed','failed','warning'))
);
CREATE INDEX idx_task_status ON "task"(status);

CREATE TABLE warm_container_pool (
  name       TEXT PRIMARY KEY,
  image      TEXT NOT NULL,
  last_used  TIMESTAMPTZ DEFAULT NOW(),
  busy       BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_warm_pool_busy_lastused
          ON warm_container_pool (busy, last_used DESC);

CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_solana_project_last_updated
  BEFORE UPDATE ON "solanaproject"
  FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

CREATE TRIGGER update_task_last_updated
  BEFORE UPDATE ON "task"
  FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();
ALTER TABLE warm_container_pool
  ADD COLUMN IF NOT EXISTS port             integer,
  ADD COLUMN IF NOT EXISTS last_heartbeat   timestamptz;

UPDATE warm_container_pool
   SET port = 0
 WHERE port IS NULL;

ALTER TABLE warm_container_pool
  ALTER COLUMN port SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
       SELECT 1
         FROM pg_constraint
        WHERE conname = 'warm_container_pool_port_key'
  ) THEN
    ALTER TABLE warm_container_pool
      ADD CONSTRAINT warm_container_pool_port_key UNIQUE (port);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_warm_pool_busy_port
    ON warm_container_pool (busy, port);

-- Add partial-unique index for non-zero ports
ALTER TABLE warm_container_pool
    DROP CONSTRAINT IF EXISTS warm_container_pool_port_key;

CREATE UNIQUE INDEX IF NOT EXISTS warm_pool_port_nonzero_uniq
           ON warm_container_pool (port)
        WHERE port <> 0;
