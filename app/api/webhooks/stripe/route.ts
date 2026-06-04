/**
 * Stripe webhook receiver.
 *
 * Deliberate exception to the "mutations go through server actions" rule:
 * this is an inbound external POST from Stripe's infrastructure, not a
 * browser-originated mutation, so a route handler is the correct primitive.
 *
 * Security contract:
 *   1. Raw body is read BEFORE any JSON parsing — required for HMAC verification.
 *   2. Signature is verified with Stripe.webhooks.constructEvent before any
 *      data is touched. Unverified events are rejected with 400.
 *   3. We always return 200 after verification even when our handler errors,
 *      to prevent Stripe from retrying and creating duplicate rows.
 */

import Stripe from 'stripe'
import { prisma } from '@/lib/db/client'
import {
  resolveWebhookOwner,
  processChargeEvent,
  processInvoiceEvent,
  processCustomerEvent,
} from '@/lib/finance/stripe-sync'

export async function POST(req: Request): Promise<Response> {
  // ── 1. Raw body — must be read before any parsing ─────────────────────────
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return new Response('STRIPE_WEBHOOK_SECRET is not configured', { status: 400 })
  }

  // ── 2. Signature verification (static method — no API key required) ────────
  // Stripe.webhooks is a static property; constructEvent does pure HMAC crypto.
  let event: Stripe.Event
  try {
    event = Stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 })
  }

  // ── 3. Resolve owner ───────────────────────────────────────────────────────
  // Single-operator tool: the owner is whoever configured the Stripe sync.
  const ownerId = await resolveWebhookOwner()
  if (!ownerId) {
    // No sync configured yet — acknowledge so Stripe doesn't retry.
    return new Response('OK', { status: 200 })
  }

  // ── 4. Handle event — best-effort ─────────────────────────────────────────
  // Errors are logged but we still return 200 to prevent Stripe retrying and
  // producing duplicates. The upsert logic is idempotent, so the next backfill
  // or retry will reconcile any missed events.
  try {
    await dispatchEvent(event, ownerId)
    await prisma.stripeSyncState.upsert({
      where: { ownerId },
      create: { ownerId, status: 'idle', lastEventAt: new Date() },
      update: { lastEventAt: new Date() },
    })
  } catch (err) {
    console.error('[stripe-webhook] handler error for', event.type, err)
  }

  return new Response('OK', { status: 200 })
}

async function dispatchEvent(event: Stripe.Event, ownerId: string): Promise<void> {
  switch (event.type) {
    case 'charge.succeeded':
    case 'charge.updated':
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      await processChargeEvent(charge, ownerId)
      break
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      // processInvoiceEvent skips internally when invoice.charge is set,
      // because charge.succeeded will fire and create the income row.
      await processInvoiceEvent(invoice, ownerId)
      break
    }
    case 'customer.created':
    case 'customer.updated': {
      const customer = event.data.object as Stripe.Customer
      await processCustomerEvent(customer, ownerId)
      break
    }
    // Other event types are acknowledged (200) and ignored.
  }
}
