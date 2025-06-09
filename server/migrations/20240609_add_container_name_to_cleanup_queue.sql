-- 20240609_add_container_name_to_cleanup_queue.sql
ALTER TABLE cleanup_queue
  ADD COLUMN IF NOT EXISTS container_name text; 