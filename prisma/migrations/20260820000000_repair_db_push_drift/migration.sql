-- Bring the database back in line with schema.prisma.
--
-- `prisma migrate diff` between a database built from these migrations and
-- schema.prisma should output nothing. It did not, and each difference was a
-- change that reached the live database through `prisma db push` without ever
-- being written down — the same way the invoices table did. There is now an
-- end-to-end test asserting the diff is empty, so this cannot silently return.
--
-- Everything here is guarded, so on the pushed database it is a no-op.

-- ── 1. transactions.frequency ───────────────────────────────────────────────
--
-- The billing cadence of a recurring transaction. `lib/daily-actions` selects
-- and filters on it, so the column has to exist for the retainer queue to run
-- at all — it does in production, and did not in any migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringFrequency') THEN
    CREATE TYPE "RecurringFrequency" AS ENUM ('monthly', 'quarterly', 'annual');
  END IF;
END $$;

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "frequency" "RecurringFrequency";

-- ── 2. Deleting a project ───────────────────────────────────────────────────
--
-- `tasks.project_id` and `time_entries.project_id` were created ON DELETE SET
-- NULL, and `20260609200000_project_only_tasks_time` later made both columns
-- NOT NULL without revisiting the foreign keys. The two cannot both hold:
-- deleting a project tries to null a NOT NULL column and the delete fails.
--
-- It is not only projects that could not be deleted. `projects_client_id_fkey`
-- cascades from the client, so deleting a client with a project that had a
-- single task or time entry raised
--
--   null value in column "project_id" of relation "tasks"
--     violates not-null constraint
--
-- which the route returned as a 500. schema.prisma has said `onDelete: Cascade`
-- on both relations since they were written; only the database disagreed.
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_project_id_fkey";
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_entries" DROP CONSTRAINT IF EXISTS "time_entries_project_id_fkey";
ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. ON UPDATE on the nullable project links ──────────────────────────────
--
-- These two already do the right thing on delete — a project going away must
-- not take the record of money or a stored file with it. They were declared
-- inline, so they picked up Postgres's default ON UPDATE NO ACTION where
-- Prisma generates ON UPDATE CASCADE. Nothing updates a primary key, so this
-- changes no behaviour; it is here so that the schema and the database stop
-- differing at all, and the drift test can insist on exactly zero difference.
ALTER TABLE "attachments" DROP CONSTRAINT IF EXISTS "attachments_project_id_fkey";
ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_project_id_fkey";
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
