-- Invoicing moves to Stripe.
--
-- Stripe becomes the system of record: it assigns the number, hosts the page
-- the client pays on, renders the PDF, sends the email and chases the payment.
-- The invoices table stops being the invoice and becomes a mirror of one, kept
-- only for what Stripe does not know — which client, which project, and which
-- time entries the work was billed from.
--
-- Existing rows are NOT pushed into Stripe. Creating real Stripe invoices for
-- them would email real clients a second copy of something they already have.
-- They stay readable as records, identified by a null stripe_invoice_id, and
-- cannot be sent or paid.

-- ── Status ────────────────────────────────────────────────────────────────────
-- Stripe's lifecycle, not ours. Postgres cannot drop a value from an enum in
-- place, so the column moves to a new type and the old one is dropped.
--
-- `sent` and `overdue` both become `open`: Stripe has no overdue state, and we
-- never really did either — it was derived from due_date on read, and only ever
-- persisted by an older version of the list query.

CREATE TYPE "InvoiceStatus_new" AS ENUM ('draft', 'open', 'paid', 'uncollectible', 'void');

ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "invoices"
  ALTER COLUMN "status" TYPE "InvoiceStatus_new"
  USING (
    CASE "status"::text
      WHEN 'sent'    THEN 'open'
      WHEN 'overdue' THEN 'open'
      ELSE "status"::text
    END
  )::"InvoiceStatus_new";

DROP TYPE "InvoiceStatus";
ALTER TYPE "InvoiceStatus_new" RENAME TO "InvoiceStatus";

ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'draft';

-- ── Stripe's copy of the invoice ──────────────────────────────────────────────

ALTER TABLE "invoices"
  ADD COLUMN "stripe_invoice_id"   TEXT,
  ADD COLUMN "stripe_customer_id"  TEXT,
  ADD COLUMN "number"              TEXT,
  ADD COLUMN "hosted_invoice_url"  TEXT,
  ADD COLUMN "invoice_pdf"         TEXT;

CREATE UNIQUE INDEX "invoices_stripe_invoice_id_key"
  ON "invoices"("stripe_invoice_id");

CREATE INDEX "invoices_stripe_customer_idx"
  ON "invoices"("stripe_customer_id");

-- Our own numbering and public page are legacy. Both stay for the rows that
-- have them and are never written again; new invoices get Stripe's number and
-- Stripe's hosted page instead.
ALTER TABLE "invoices"
  ALTER COLUMN "invoice_number" DROP NOT NULL,
  ALTER COLUMN "public_token"   DROP NOT NULL;

-- ── Per-user webhook endpoints ────────────────────────────────────────────────
-- Replaces the single deployment-wide STRIPE_WEBHOOK_SECRET and the
-- resolve-the-owner-by-guessing that went with it. Each user's endpoint is
-- registered against their own Stripe account and posts to a path carrying
-- their token, so the owner of an event is known rather than inferred.

ALTER TABLE "users"
  ADD COLUMN "webhook_token"          TEXT,
  ADD COLUMN "stripe_webhook_id"      TEXT,
  ADD COLUMN "stripe_webhook_secret"  TEXT;

CREATE UNIQUE INDEX "users_webhook_token_key" ON "users"("webhook_token");
