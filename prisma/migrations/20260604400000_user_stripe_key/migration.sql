-- Migration: user_stripe_key
-- Adds encrypted Stripe key storage to the users table.
-- stripe_key: AES-256-GCM ciphertext (iv:authTag:ciphertext, base64-encoded parts)
-- stripe_key_hint: last-4 chars of the raw key for display only (not sensitive)

ALTER TABLE "users"
  ADD COLUMN "stripe_key"      TEXT,
  ADD COLUMN "stripe_key_hint" TEXT;
