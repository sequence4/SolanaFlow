-- adds missing container_name column to cleanup_queue
ALTER TABLE cleanup_queue
  ADD COLUMN IF NOT EXISTS container_name TEXT NOT NULL DEFAULT '';

-- existing rows inserted before this migration have '', which is fine:
-- the very first subsequent markContainerForCleanup() call will
-- insert real names and the empty-string rows will age out naturally. 