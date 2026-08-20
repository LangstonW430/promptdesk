/**
 * Environment the app under test and the tests themselves have to agree on.
 *
 * The Stripe key encryption is symmetric and deployment-wide, so a test that
 * writes an encrypted webhook secret into the database must use the same key
 * the app will decrypt it with. Both read it from here.
 *
 * It protects nothing. It is committed, it is the same in every checkout, and
 * it only ever encrypts fixtures — a real one is generated per deployment and
 * never leaves the environment. It is a valid 32-byte key so that the real
 * AES-256-GCM path runs rather than being skipped for want of one.
 */
export const STRIPE_ENCRYPTION_KEY =
  'e2e00000000000000000000000000000000000000000000000000000000e2e00'
