/**
 * What a verified Stripe event does, independent of which route received it.
 *
 * Two routes reach this: the per-user endpoint at
 * /api/webhooks/stripe/[endpointToken], and the legacy shared endpoint at
 * /api/webhooks/stripe. Keeping the dispatch here means they cannot drift into
 * handling different event types.
 *
 * Every handler is idempotent. Stripe retries on any non-2xx and will happily
 * redeliver an event we already processed.
 */

import type Stripe from 'stripe'
import { prisma } from '@/lib/db/client'
import {
  processChargeEvent,
  processInvoiceEvent,
  processCustomerEvent,
  processSubscriptionEvent,
} from './stripe-sync'
import { markInvoicePaidFromStripe, syncInvoiceFromStripe } from '@/lib/invoices'

export async function handleStripeEvent(
  event: Stripe.Event,
  ownerId: string,
): Promise<void> {
  switch (event.type) {
    case 'charge.succeeded':
    case 'charge.updated':
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      await processChargeEvent(charge, ownerId)
      break
    }

    // ── Invoice lifecycle ────────────────────────────────────────────────────
    // Stripe owns invoice status now, so these are the only thing that moves an
    // invoice past draft. Nothing in the app writes a status of its own.
    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.id) {
        // Records the income transaction as well as the status. Skips both if a
        // transaction is already linked, so the two paid events Stripe sends for
        // one payment cannot bank the money twice.
        await markInvoicePaidFromStripe(ownerId, invoice.id, invoice)
      }
      // Also runs the finance-side import, which recognises revenue for invoices
      // raised outside PromptDesk. It no-ops when a backing charge exists,
      // because charge.succeeded handles that case.
      await processInvoiceEvent(invoice, ownerId)
      break
    }
    case 'invoice.finalized':
    case 'invoice.sent':
    case 'invoice.updated':
    case 'invoice.voided':
    case 'invoice.marked_uncollectible':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.id) {
        await syncInvoiceFromStripe(ownerId, invoice.id, invoice)
      }
      break
    }

    case 'customer.created':
    case 'customer.updated': {
      const customer = event.data.object as Stripe.Customer
      await processCustomerEvent(customer, ownerId)
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      // Without these, cancelling a subscription in Stripe changed nothing
      // here: its charges stayed flagged recurring and kept counting toward
      // MRR forever.
      const subscription = event.data.object as Stripe.Subscription
      await processSubscriptionEvent(subscription, ownerId)
      break
    }
    // Other event types are acknowledged and ignored.
  }

  await prisma.stripeSyncState.upsert({
    where: { ownerId },
    create: { ownerId, status: 'idle', lastEventAt: new Date() },
    update: { lastEventAt: new Date() },
  })
}
