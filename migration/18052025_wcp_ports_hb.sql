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
