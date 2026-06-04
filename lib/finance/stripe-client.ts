import Stripe from 'stripe'
import { getDecryptedStripeKey } from './stripe-key'

// Pinned to the API version shipped with stripe SDK v22.2.0.
// Update intentionally alongside SDK upgrades; a version bump may require
// code changes in stripe-mapper.ts and stripe-sync.ts.
export const STRIPE_API_VERSION = '2026-05-27.dahlia' as const

/**
 * Returns a Stripe client for the given owner.
 *
 * Resolution order:
 *   1. Per-user encrypted key stored in users.stripe_key (set via Settings → Stripe)
 *   2. STRIPE_RESTRICTED_KEY env var (legacy / self-hosted fallback)
 *
 * Throws a user-readable error when neither is configured.
 *
 * A new Stripe instance is created per call — cheap, and avoids caching a
 * stale key after the user updates their credentials in Settings.
 */
export async function getStripeForOwner(ownerId: string): Promise<Stripe> {
  const dbKey = await getDecryptedStripeKey(ownerId)
  if (dbKey) {
    return new Stripe(dbKey, { apiVersion: STRIPE_API_VERSION })
  }

  const envKey = process.env.STRIPE_RESTRICTED_KEY
  if (envKey) {
    return new Stripe(envKey, { apiVersion: STRIPE_API_VERSION })
  }

  throw new Error(
    'Stripe is not connected. Go to Settings → Stripe and paste your restricted API key.',
  )
}

// ─── Legacy singleton (used by webhook handler for static Stripe.webhooks) ───

// The webhook route uses Stripe.webhooks.constructEvent which is a static method
// and doesn't need a real key. This thin wrapper is kept only for that path;
// all data-fetching calls should use getStripeForOwner(ownerId) instead.
export function getStripe(): Stripe {
  const key =
    process.env.STRIPE_RESTRICTED_KEY ??
    'rk_placeholder_for_static_webhook_use_only'
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION })
}
