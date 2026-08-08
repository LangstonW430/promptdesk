-- Make an invoice a valid commercial document.
--
-- The invoice rendered well and the arithmetic was right, but it identified
-- neither party beyond a name. A client's bookkeeper needs a supplier address
-- and a tax number to file it, and most jurisdictions require both parties'
-- addresses for the invoice to be valid at all.
--
-- Currency is deliberately not addressed: this is a single-operator tool
-- billing in USD, and a currency column that is always 'usd' is a column that
-- will drift out of sync with the five places that format money. If that ever
-- changes, add it then.

-- ── 1. Who is billing ───────────────────────────────────────────────────────
--
-- Free text with newlines rather than decomposed street/city/postcode fields:
-- one operator, one address, printed verbatim. Structured address parts buy
-- nothing here and get in the way of international formats.
ALTER TABLE "users"
  ADD COLUMN "business_address"       TEXT,
  ADD COLUMN "business_phone"         TEXT,
  ADD COLUMN "tax_number"             TEXT,
  ADD COLUMN "default_payment_terms"  TEXT;

COMMENT ON COLUMN "users"."tax_number" IS
  'EIN, VAT number, UTR — whatever the operator''s jurisdiction calls it. Printed on invoices.';

-- ── 2. Who is being billed ──────────────────────────────────────────────────
ALTER TABLE "clients" ADD COLUMN "address" TEXT;

-- ── 3. What the invoice states ──────────────────────────────────────────────
--
-- `tax_rate` sits alongside the existing `tax` amount. The amount alone cannot
-- be read back into a rate — subtotal and tax give you a number, but not one
-- you would print, and rounding makes it lie. Without the rate the document
-- can only say "Tax $1,760.00", which does not tell a client whether that is
-- sales tax, VAT, or what percentage was applied.
--
-- `payment_terms` is copied from the user's default at creation rather than
-- read through at display time: an invoice must always state the terms it was
-- actually sent under, so changing the default later cannot rewrite history.
ALTER TABLE "invoices"
  ADD COLUMN "tax_rate"       NUMERIC(5, 2),
  ADD COLUMN "payment_terms"  TEXT,
  ADD COLUMN "purchase_order" TEXT;

-- Existing invoices keep a NULL rate. Backfilling it from
-- `round(tax / subtotal * 100)` would invent precision that was never
-- recorded — a $1,760.00 tax on $22,000.00 is 8%, but the same amounts arise
-- from rates that were rounded differently, and printing a guessed rate on a
-- document a client already has is worse than printing none. Old invoices show
-- the tax amount alone, exactly as they always did.
