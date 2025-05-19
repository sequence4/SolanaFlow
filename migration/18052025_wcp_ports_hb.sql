ALTER TABLE warm_container_pool
  ADD COLUMN port              integer,
  ADD COLUMN last_heartbeat    timestamptz;

UPDATE warm_container_pool
   SET port = 0
 WHERE port IS NULL;

ALTER TABLE warm_container_pool
  ALTER COLUMN port SET NOT NULL,
  ADD CONSTRAINT warm_container_pool_port_key UNIQUE (port);
