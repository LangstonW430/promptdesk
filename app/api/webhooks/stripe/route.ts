/**
 * Legacy shared Stripe webhook receiver.
 *
 * Superseded by /api/webhooks/stripe/[endpointToken], which is registered
 * against each user's own Stripe account when they connect their key. This path
 * stays so an endpoint already configured in someone's Stripe dashboard keeps
 * delivering until they reconnect, at which point the per-user endpoint takes
 * over.
 *
 * The owner is no longer guessed. This used to call `resolveWebhookOwner()`,
 * which returned whichever owner had synced most recently and would happily
 * attribute one Stripe account's events to a different user. Here the owner is
 * only resolved when exactly one user has Stripe configured — which is the only
 * case where a single shared secret could ever have meant one specific person.
 * Anything else is refused rather than guessed at.
 */

import Stripe from 'stripe'
import { prisma } from '@/lib/db/client'
import { handleStripeEvent } from '@/lib/finance/webhook-handler'

/**
 * The one user this shared endpoint can only possibly mean.
 *
 * Null when nobody has connected Stripe, and — importantly — also null when
 * more than one has. A shared secret cannot distinguish between them, so there
 * is no answer to give, and inventing one writes money to the wrong ledger.
 */
async function resolveSoleStripeOwner(): Promise<string | null> {
  const users = await prisma.user.findMany({
    where: { stripeKey: { not: null } },
    select: { id: true },
    take: 2,
  })
  return users.length === 1 ? users[0].id : null
}

export async function POST(req: Request): Promise<Response> {
  // ── 1. Raw body — must be read before any parsing ──────────────────────────
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return new Response('STRIPE_WEBHOOK_SECRET is not configured', { status: 400 })
  }

  // ── 2. Signature verification ──────────────────────────────────────────────
  let event: Stripe.Event
  try {
    event = Stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 })
  }

  // ── 3. Resolve owner ───────────────────────────────────────────────────────
  const ownerId = await resolveSoleStripeOwner()
  if (!ownerId) {
    // Acknowledged so Stripe stops retrying something that cannot be delivered.
    // Logged because for a multi-user deployment this means events are being
    // dropped and each user needs to reconnect onto their own endpoint.
    console.warn(
      '[stripe-webhook] shared endpoint received an event with no unambiguous ' +
        'owner. Reconnect Stripe in Settings to register a per-user endpoint.',
    )
    return new Response('OK', { status: 200 })
  }

  // ── 4. Handle — best effort, always acknowledged ───────────────────────────
  try {
    await handleStripeEvent(event, ownerId)
  } catch (err) {
    console.error('[stripe-webhook] handler error for', event.type, err)
  }

  return new Response('OK', { status: 200 })
}
