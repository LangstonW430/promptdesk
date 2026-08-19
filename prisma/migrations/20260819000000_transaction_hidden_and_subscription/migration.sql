-- Hiding imported rows, and knowing which subscription a charge came from.
--
-- `hidden_at` rather than a delete: a Stripe-imported transaction cannot be
-- removed, because the next backfill re-imports the same charge and it comes
-- straight back. Hiding takes it off the table and out of every total while
-- leaving the row for the importer to match against. Manual rows keep using
-- DELETE, which is still the right thing for something typed in by mistake.
--
-- `stripe_subscription_id` records which subscription billed a charge. Without
-- it, cancelling in Stripe left the charge flagged `is_recurring` forever with
-- nothing to tie the cancellation back to, so it kept counting toward MRR.
-- Nullable throughout: one-off charges and manual rows have no subscription.

ALTER TABLE "transactions"
  ADD COLUMN "hidden_at" TIMESTAMPTZ(6),
  ADD COLUMN "stripe_subscription_id" TEXT;

-- The webhook looks charges up by subscription to end their standing charge,
-- and every such lookup is owner-scoped like the rest of the table.
CREATE INDEX "transactions_owner_subscription_idx"
  ON "transactions"("owner_id", "stripe_subscription_id");
