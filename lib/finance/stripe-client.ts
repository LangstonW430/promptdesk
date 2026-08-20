import Stripe from 'stripe'
import { prisma } from '@/lib/db/client'
import { getDecryptedStripeKey } from './stripe-key'

// Pinned to the API version shipped with stripe SDK v22.2.0.
// Update intentionally alongside SDK upgrades; a version bump may require
// code changes in stripe-mapper.ts and stripe-sync.ts.
export const STRIPE_API_VERSION = '2026-05-27.dahlia' as const

/**
 * Whether STRIPE_RESTRICTED_KEY can stand in for a user who has not connected
 * their own Stripe account.
 *
 * Only when this deployment holds exactly one user. The env key belongs to
 * whoever runs the deployment, and the callers of `getStripeForOwner` do real
 * things with it: `backfillStripe` imports that account's charges into the
 * asking user's ledger, `importStripeInvoices` imports its invoices — customer
 * names, billing emails, amounts — and the invoice lifecycle calls finalize,
 * send, void and write off live objects in it. On a single-user deployment
 * that is the operator reaching their own account, which is what the fallback
 * was for. With a second user it is one person handed another's payment
 * history and the ability to bill their customers.
 *
 * Same rule, and same reasoning, as `resolveSoleStripeOwner` in the legacy
 * shared webhook route: a deployment-wide secret can only mean one specific
 * person when there is only one person it could mean. `take: 2` is enough to
 * tell "one" from "more than one" without counting the whole table.
 */
async function isSingleTenantDeployment(): Promise<boolean> {
  const users = await prisma.user.findMany({ select: { id: true }, take: 2 })
  return users.length <= 1
}

/**
 * Returns a Stripe client for the given owner.
 *
 * Resolution order:
 *   1. Per-user encrypted key stored in users.stripe_key (set via Settings → Stripe)
 *   2. STRIPE_RESTRICTED_KEY env var — self-hosted fallback, single-tenant only
 *
 * Throws a user-readable error when neither applies.
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
  if (envKey && (await isSingleTenantDeployment())) {
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
