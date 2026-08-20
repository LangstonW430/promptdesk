/**
 * Per-user Stripe webhook receiver.
 *
 * Deliberate exception to the "mutations go through server actions" rule: this
 * is an inbound external POST from Stripe's infrastructure, not a
 * browser-originated mutation, so a route handler is the correct primitive.
 *
 * The token in the path is what identifies the owner. It replaces
 * `resolveWebhookOwner()`, which picked whichever owner had synced most
 * recently and so could record one Stripe account's events against a different
 * user entirely. That was survivable only while invoice payments carried an
 * ownerId in their metadata; now that Stripe owns the invoice lifecycle and
 * status arrives by webhook alone, a misattributed event corrupts data.
 *
 * The token is not a credential. It selects which signing secret to verify
 * against — nothing is trusted until that signature checks out, so knowing a
 * token gets an attacker no further than an unsigned request would.
 *
 * Security contract:
 *   1. Raw body is read BEFORE any JSON parsing — required for HMAC verification.
 *   2. Signature is verified against that user's own secret before any data is
 *      touched. Unverified events are rejected with 400.
 *   3. After verification we always return 200, even when a handler throws, so
 *      Stripe stops retrying. Handlers are idempotent and the next backfill
 *      reconciles anything missed.
 */

import Stripe from 'stripe'
import { prisma } from '@/lib/db/client'
import { decryptKey } from '@/lib/finance/stripe-key'
import { handleStripeEvent } from '@/lib/finance/webhook-handler'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ endpointToken: string }> },
): Promise<Response> {
  const { endpointToken } = await params

  // ── 0. Cost of guessing ────────────────────────────────────────────────────
  // The token is not a credential — the signature check below is what protects
  // the data, and a wrong token is refused before anything is read. But a
  // caller can still tell a valid token from an invalid one by whether they get
  // 400 or 404, and walking the space unmetered is free reconnaissance plus a
  // database lookup per attempt. Generous enough that Stripe's own delivery and
  // retry rates never approach it.
  const ip = clientIp(req.headers)
  const attempts = rateLimit('stripe-webhook', ip, { limit: 120, windowMs: 60_000 })
  if (!attempts.ok) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'retry-after': String(attempts.retryAfterSeconds) },
    })
  }

  // ── 1. Raw body — must be read before any parsing ──────────────────────────
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  // ── 2. Whose endpoint is this? ─────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { webhookToken: endpointToken },
    select: { id: true, stripeWebhookSecret: true },
  })
  // 404 rather than 200: an unknown token is a misconfigured or stale endpoint,
  // and silently accepting it would hide that from whoever set it up.
  if (!user?.stripeWebhookSecret) {
    return new Response('Unknown webhook endpoint', { status: 404 })
  }

  let secret: string
  try {
    secret = decryptKey(user.stripeWebhookSecret)
  } catch {
    return new Response('Webhook secret could not be read', { status: 500 })
  }

  // ── 3. Signature verification ──────────────────────────────────────────────
  // Stripe.webhooks is a static property; constructEvent is pure HMAC crypto
  // and needs no API key.
  let event: Stripe.Event
  try {
    event = Stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 })
  }

  // ── 4. Handle — best effort, always acknowledged ───────────────────────────
  try {
    await handleStripeEvent(event, user.id)
  } catch (err) {
    console.error('[stripe-webhook] handler error for', event.type, err)
  }

  return new Response('OK', { status: 200 })
}
