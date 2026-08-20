-- The invoices table, which had never been written down.
--
-- Invoicing shipped in a2e0c0f with a schema change and no migration: the
-- table, its enum, and `time_entries.invoice_id` were all created with
-- `prisma db push` straight onto the live database. Every later migration then
-- built on objects that no migration creates — `20260609000000_invoices_rls`
-- says so out loud ("created via prisma db push") and enables RLS on a table
-- that, on a fresh database, is not there.
--
-- So `prisma migrate deploy` against an empty database has been failing since
-- June: it gets as far as invoices_rls and stops. Only the one database that
-- was pushed to has ever had these objects. This migration is the CREATE that
-- should have accompanied that commit, restored in its original position so
-- the history replays.
--
-- It describes the table as it was in June, not as it is now — the four later
-- migrations that add Stripe's columns, archiving, tax rate and the nullable
-- client still have to run after it and expect the June shape.
--
-- Every statement is guarded. On the pushed database each object already
-- exists and the whole file is a no-op; `migrate deploy` records it and moves
-- on without touching a row.

-- ── Status ──────────────────────────────────────────────────────────────────
-- The original four values. `20260819010000_stripe_invoicing` later replaces
-- this type wholesale with Stripe's lifecycle, so the guard matters: on the
-- pushed database the name is already taken by that newer enum.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
    CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'sent', 'paid', 'overdue');
  END IF;
END $$;

-- ── The table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "invoices" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id"       UUID NOT NULL,
    "invoice_number" INTEGER NOT NULL,
    "public_token"   TEXT NOT NULL,
    "client_id"      UUID NOT NULL,
    "project_id"     UUID,
    "line_items"     JSONB NOT NULL,
    "status"         "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "issue_date"     DATE NOT NULL,
    "due_date"       DATE NOT NULL,
    "subtotal"       DECIMAL(12,2) NOT NULL,
    "tax"            DECIMAL(12,2),
    "total"          DECIMAL(12,2) NOT NULL,
    "notes"          TEXT,
    "transaction_id" UUID,
    "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_public_token_key"   ON "invoices"("public_token");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_transaction_id_key" ON "invoices"("transaction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_owner_number_unique" ON "invoices"("owner_id", "invoice_number");
CREATE INDEX IF NOT EXISTS "invoices_owner_status_idx" ON "invoices"("owner_id", "status");
CREATE INDEX IF NOT EXISTS "invoices_client_idx"       ON "invoices"("client_id");

DO $$
BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Cascade from the client as it was in June. `20260819020000_import_stripe_invoices`
-- drops this and re-adds it as SET NULL, so that a deleted client does not
-- erase the record of money they were billed.
DO $$
BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Which invoice billed a time entry ───────────────────────────────────────
-- Pushed at the same time and missing for the same reason. Without it,
-- "unbilled time" has nothing to exclude against.
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "invoice_id" UUID;

DO $$
BEGIN
  ALTER TABLE "time_entries"
    ADD CONSTRAINT "time_entries_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
