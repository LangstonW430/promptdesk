-- Migration: transaction_is_recurring
-- Adds is_recurring flag to transactions.
-- true = income from a Stripe Subscription (MRR); false = one-off payment.

ALTER TABLE "transactions"
  ADD COLUMN "is_recurring" BOOLEAN NOT NULL DEFAULT false;
