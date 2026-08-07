-- Stop storing a status on the client; derive their stage from their projects.
--
-- A client carried `status` (lead → contacted → proposal_sent → negotiating →
-- won → lost) while the work they had commissioned carried its own status
-- (proposed | active | completed | on_hold | cancelled). Two fields described
-- one situation, and nothing kept them honest: a client could sit at
-- "negotiating" with three active projects, or at "won" with none. Whichever
-- one a screen happened to read decided what the user was told.
--
-- The stage is now a rule over the work — see lib/clients/stage.ts:
--
--   archived                → Lost
--   any active project      → Active client
--   any proposed project    → Proposal out
--   any completed project   → Past client
--   a contact date or note  → Contacted
--   otherwise               → Lead
--
-- It has no column because it is not a fact anyone records; it is a reading of
-- facts already recorded. Moving a client along means quoting them, starting
-- the work, finishing it, or archiving them.

-- ── 1. `clients.status` is retained, not dropped ────────────────────────────
--
-- Same reasoning as `clients.estimated_value` in 20260806100000: the
-- application no longer reads or writes it, but leaving it means this migration
-- loses no data. It is the only remaining record of what each client's status
-- had been set to, and the derived stage will differ for anyone whose status
-- was never reflected in their projects — a client marked "won" who has no
-- project reads as Contacted now, because from the data that is all anyone can
-- honestly say about them.
--
-- No backfill is attempted. Inventing projects to justify an old status would
-- put made-up work in the projects list and made-up numbers in the pipeline.
-- Drop the column in a later migration once the derived stages have been
-- checked against the real data.
COMMENT ON COLUMN "clients"."status" IS
  'Superseded by the derived client stage (see lib/clients/stage.ts). Nothing reads or writes it; retained so the 20260807000000 migration loses no data.';

-- ── 2. Drop the index that supported filtering by it ────────────────────────
--
-- `clients_owner_status_idx` existed for the status filter on /clients and the
-- dashboard's per-stage counts. Neither queries the column any more — a stage
-- cannot appear in a WHERE clause — so the index is now pure write overhead on
-- every client insert and update.
DROP INDEX IF EXISTS "clients_owner_status_idx";
