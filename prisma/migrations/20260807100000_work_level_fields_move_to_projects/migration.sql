-- Move four things that describe work off the client and onto the project.
--
-- Same category error each time: a singular field on the client describing
-- something the client has many of. `status` and `estimated_value` went first
-- (20260806100000, 20260807000000); these are the rest of them.

-- ── 1. projects.rate ────────────────────────────────────────────────────────
--
-- `clients.default_rate` was read in exactly one place: the project page, to
-- seed the rate on a new time entry. A rate is a term of an engagement, not a
-- property of a person — a retainer and a one-off build for the same client
-- bill differently, and the second silently inherited the first's number.
ALTER TABLE "projects" ADD COLUMN "rate" NUMERIC(10, 2);

-- Backfill: every existing project inherits its client's rate, which is
-- exactly the number the project page was already showing for it. Nothing
-- changes for anyone until they set a project rate of their own.
UPDATE "projects" p
   SET "rate" = c."default_rate"
  FROM "clients" c
 WHERE c."id" = p."client_id"
   AND c."default_rate" IS NOT NULL;

-- `clients.default_rate` is not dropped. No screen in the app ever wrote it —
-- it is not on the client form, the importer or the REST surface — so the only
-- rows carrying a value got one directly against the database. Dropping it
-- would throw those away, and createProject still reads it as the starting
-- rate for a client's first project, so they keep working.
COMMENT ON COLUMN "clients"."default_rate" IS
  'Superseded by projects.rate. No live view reads it; createProject uses it as the starting rate for a client''s first project.';

-- ── 2. clients.project_type retired ─────────────────────────────────────────
--
-- One free-text "project type" on a client who can have many projects, each
-- with its own title and deliverables. Purely descriptive — nothing structural
-- read it. Retained, not dropped, on the same terms as the columns above.
COMMENT ON COLUMN "clients"."project_type" IS
  'Superseded by the client''s projects (projects.title, projects.deliverables). Nothing reads it; retained so this migration loses no data.';

-- ── 3. transactions.project_id ──────────────────────────────────────────────
--
-- Money could be attributed to a client but not to the work it paid for, so
-- nothing could answer whether a project earned what it was quoted at. The
-- column is nullable because plenty of money legitimately has no project:
-- overheads, hosting, retainers not tied to one piece of work.
--
-- ON DELETE SET NULL rather than CASCADE: deleting a project must never delete
-- the record of money that changed hands.
ALTER TABLE "transactions"
  ADD COLUMN "project_id" UUID REFERENCES "projects"("id") ON DELETE SET NULL;

CREATE INDEX "transactions_project_idx" ON "transactions" ("project_id");

-- Backfill from invoices. An invoice already records which project it billed
-- for, and a paid one links to the transaction that settled it, so this
-- recovers the attribution for every invoiced payment without guessing.
-- Income that never went through an invoice stays unattributed, which is the
-- honest reading — nothing in the data says which project it was for.
UPDATE "transactions" t
   SET "project_id" = i."project_id"
  FROM "invoices" i
 WHERE i."transaction_id" = t."id"
   AND i."project_id" IS NOT NULL;

-- ── 4. attachments.project_id ───────────────────────────────────────────────
--
-- A proposal, a signed scope, or design files belong to a piece of work; on
-- the client they piled into one list where nothing said which proposal went
-- with which project. Nullable because an NDA or a W-9 genuinely is about the
-- client and not about any one project.
--
-- ON DELETE SET NULL for the same reason as above: deleting a project must not
-- orphan the stored file, which would leave a row in Supabase Storage with
-- nothing pointing at it.
ALTER TABLE "attachments"
  ADD COLUMN "project_id" UUID REFERENCES "projects"("id") ON DELETE SET NULL;

CREATE INDEX "attachments_project_idx" ON "attachments" ("project_id");

-- attachments had no index on client_id at all, despite every read being
-- "the files for this client". Added here while the table is being altered.
CREATE INDEX IF NOT EXISTS "attachments_client_idx" ON "attachments" ("client_id");
