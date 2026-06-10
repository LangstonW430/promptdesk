-- Remove client_id from tasks and time_entries; make project_id required on both.
-- Orphaned rows (no project) are deleted first so the NOT NULL constraint applies cleanly.

-- 1. Drop orphaned tasks (tasks without a project)
DELETE FROM tasks WHERE project_id IS NULL;

-- 2. Drop orphaned time entries (time entries without a project)
DELETE FROM time_entries WHERE project_id IS NULL;

-- 3. Tasks: drop client-related index, FK, and column
DROP INDEX IF EXISTS tasks_client_done_due_idx;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_client_id_fkey;
ALTER TABLE tasks DROP COLUMN IF EXISTS client_id;

-- 4. Tasks: make project_id NOT NULL
ALTER TABLE tasks ALTER COLUMN project_id SET NOT NULL;

-- 5. Time entries: drop client-related index, FK, and column
DROP INDEX IF EXISTS time_entries_client_date_idx;
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_client_id_fkey;
ALTER TABLE time_entries DROP COLUMN IF EXISTS client_id;

-- 6. Time entries: make project_id NOT NULL
ALTER TABLE time_entries ALTER COLUMN project_id SET NOT NULL;
