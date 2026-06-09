-- Migration: invoices_rls
-- The invoices table was created via prisma db push without RLS.
-- This enables RLS and adds the standard owner-scoped policy to match every other table.

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices: owner access"
  ON invoices
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
