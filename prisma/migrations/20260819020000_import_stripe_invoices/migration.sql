-- Make room for invoices that were raised in Stripe rather than here.
--
-- An invoice created in the Stripe dashboard is billed to a Stripe customer who
-- may not exist in the CRM at all. It still has to appear in the invoice list,
-- so the three things that assumed "we created this" have to relax:
--
--   1. client_id becomes nullable. Matching runs on the Stripe customer id
--      first and the billing email second; when neither hits, the invoice shows
--      unattributed and can be linked by hand. Auto-creating a client instead
--      would fill the CRM with unvetted contacts, which is the same reason
--      linkTransactionsByEmail has always refused to.
--
--   2. customer_name / customer_email record who Stripe says the invoice is
--      for, so an unattributed row still shows a name instead of a blank cell.
--
--   3. due_date becomes nullable. Stripe invoices set to charge automatically
--      carry no due date -- they are collected, not awaited.

ALTER TABLE "invoices"
  ALTER COLUMN "client_id" DROP NOT NULL,
  ALTER COLUMN "due_date"  DROP NOT NULL,
  ADD COLUMN "customer_name"  TEXT,
  ADD COLUMN "customer_email" TEXT;

-- Deleting a client must not erase the record of money they were billed --
-- the rule transactions already follow. The invoice keeps customer_name, so it
-- still says who it was for.
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_client_id_fkey";

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The importer looks invoices up by billing email when no customer id matches.
CREATE INDEX IF NOT EXISTS "invoices_owner_customer_email_idx"
  ON "invoices"("owner_id", "customer_email");
