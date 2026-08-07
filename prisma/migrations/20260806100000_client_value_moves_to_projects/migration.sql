-- Move opportunity value from the client onto projects.
--
-- `clients.estimated_value` recorded a per-client forecast, which put the
-- number on the person rather than on the work being proposed. Value now lives
-- on `projects.budget`, and the client-level figures the dashboard and the Hot
-- Leads queue report are derived by summing the budgets of a client's open
-- projects.
--
-- Two parts: a new `proposed` project status so work can carry a number before
-- it is won, and a backfill so no existing forecast is lost.

-- ── 1. `proposed` status ────────────────────────────────────────────────────
--
-- projects.status is a TEXT column with an application-level union rather than
-- a Postgres enum, so admitting a new value needs no DDL. Recorded here because
-- the set of legal values is part of the schema even when the column does not
-- enforce it:
--
--   proposed | active | completed | on_hold | cancelled
--
-- `proposed` means quoted but not yet won. It counts toward pipeline value and
-- is excluded from the invoice project picker, which only offers active work.

-- ── 2. Backfill ─────────────────────────────────────────────────────────────
--
-- One project per client that carries a value but has no projects at all. The
-- "no projects" guard is deliberate: where a client already has projects, those
-- budgets are the figure the dashboard will now report, and adding another row
-- carrying the old client-level estimate on top would silently inflate every
-- pipeline total by double-counting the same opportunity.
--
-- Clients skipped by that guard keep their value in `clients.estimated_value`,
-- which this migration does not drop — see part 3.
--
-- On RLS: `projects` has row level security enabled but not FORCEd, and
-- `prisma migrate deploy` connects over DIRECT_URL as the table owner, who
-- bypasses policies. Were the policy applied, `auth.uid()` is NULL outside a
-- request and the WITH CHECK would reject every row.
INSERT INTO "projects" (
  "owner_id", "client_id", "title", "status", "budget", "deliverables", "is_archived"
)
SELECT
  c."owner_id",
  c."id",
  COALESCE(
    NULLIF(btrim(c."company_name"), ''),
    NULLIF(btrim(c."contact_name"), ''),
    'Untitled client'
  ) || ' — opportunity',
  'proposed',
  c."estimated_value",
  '[]'::jsonb,
  false
FROM "clients" c
WHERE c."estimated_value" IS NOT NULL
  AND c."estimated_value" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "projects" p WHERE p."client_id" = c."id"
  );

-- ── 3. The old column ───────────────────────────────────────────────────────
--
-- `clients.estimated_value` is deliberately NOT dropped. The application no
-- longer reads or writes it, but leaving it means this migration loses no data
-- and can be reasoned about after the fact — including for the clients the
-- backfill guard skipped. Drop it in a later migration once the derived figures
-- have been checked against the real data.
