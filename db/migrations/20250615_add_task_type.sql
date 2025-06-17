-- Add TEXT column only if it does not yet exist
ALTER TABLE "task"
  ADD COLUMN IF NOT EXISTS task_type TEXT;
-- back-fill historical rows that carried the prefix inside id
-- (optional, harmless if none match)
UPDATE "task"
   SET task_type = 'WRITESRCS'
 WHERE id::text LIKE 'WRITESRCS%'; 