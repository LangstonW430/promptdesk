/**
 * Stripe sync engine — all I/O lives here.
 *
 * IMPORTANT revenue recognition rules (matches stripe-mapper.ts):
 *   - Income is recognised at the charge event (gross amount).
 *   - The Stripe processing fee is recorded as a separate expense row.
 *   - Refunds are recorded as expense rows so they net against income.
 *   - Payouts and balance transfers are INTENTIONALLY EXCLUDED.
 *     Payouts are the same charge money moving to your bank; counting them
 *     would double revenue in P&L totals.
 */

import type Stripe from 'stripe'
import type { Prisma } from '@/lib/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { getStripeForOwner } from './stripe-client'
import {
  chargeToTransaction,
  chargeFeeToTransaction,
  refundToTransaction,
  invoiceToTransaction,
  type StripeTransactionData,
} from './stripe-mapper'

// ─── Sync state ───────────────────────────────────────────────────────────────

export type SerializedSyncState = {
  status: string
  lastBackfillAt: string | null
  lastEventAt: string | null
  lastError: string | null
}

export async function getSyncState(
  ownerId: string,
): Promise<SerializedSyncState | null> {
  const state = await prisma.stripeSyncState.findUnique({ where: { ownerId } })
  if (!state) return null
  return {
    status: state.status,
    lastBackfillAt: state.lastBackfillAt?.toISOString() ?? null,
    lastEventAt: state.lastEventAt?.toISOString() ?? null,
    lastError: state.lastError,
  }
}

// ─── Upsert helpers ───────────────────────────────────────────────────────────

async function upsertTransaction(
  data: StripeTransactionData,
): Promise<string> {
  // The unique constraint (ownerId, source, externalId) makes this idempotent.
  // Re-running the backfill updates amounts/metadata but never duplicates rows.
  const row = await prisma.transaction.upsert({
    where: {
      ownerId_source_externalId: {
        ownerId: data.ownerId,
        source: 'stripe',
        externalId: data.externalId,
      },
    },
    create: {
      ownerId: data.ownerId,
      type: data.type,
      source: 'stripe',
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      category: data.category,
      occurredAt: data.occurredAt,
      clientId: null,
      externalId: data.externalId,
      externalType: data.externalType,
      metadata: data.metadata as unknown as Prisma.InputJsonValue,
    },
    update: {
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      category: data.category,
      occurredAt: data.occurredAt,
      metadata: data.metadata as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  })
  return row.id
}

// ─── Client linking ───────────────────────────────────────────────────────────

/**
 * Attempts to link a batch of transaction rows to an existing CRM Client by
 * matching the counterparty email. If a match is found:
 *   - sets clientId on all given transaction rows
 *   - back-fills client.stripeCustomerId if it isn't already set
 *
 * Never auto-creates a Client — that would pollute the CRM with unvetted data.
 */
async function linkTransactionsByEmail(
  ownerId: string,
  email: string | null | undefined,
  stripeCustomerId: string | null | undefined,
  transactionIds: string[],
): Promise<void> {
  if (!email || transactionIds.length === 0) return

  const client = await prisma.client.findFirst({
    where: { ownerId, email },
    select: { id: true, stripeCustomerId: true },
  })
  if (!client) return

  await prisma.transaction.updateMany({
    where: { id: { in: transactionIds }, ownerId },
    data: { clientId: client.id },
  })

  if (!client.stripeCustomerId && stripeCustomerId) {
    await prisma.client.update({
      where: { id: client.id },
      data: { stripeCustomerId },
    })
  }
}

// ─── Backfill ─────────────────────────────────────────────────────────────────

/**
 * Full historical backfill of succeeded charges.
 *
 * - Paginate stripe.charges.list (succeeded only, expand balance_transaction
 *   + customer) using autoPagingEach so memory stays bounded.
 * - For each charge: upsert income row + fee expense row + any refund rows.
 * - Attempt client linking by email.
 * - Idempotent: re-running creates no duplicates thanks to the unique constraint.
 *
 * NOT included: payouts, balance transfers, pending/failed charges.
 * These are excluded by design — see module-level comment.
 */
// ─── Webhook event processors ─────────────────────────────────────────────────
// Called by the route handler for real-time events. All three reuse the same
// private upsertTransaction / linkTransactionsByEmail helpers as the backfill.

/**
 * Finds the ownerId for incoming webhook events.
 * For a single-operator deployment there is exactly one StripeSyncState row.
 * Falls back to any existing Stripe transaction if no sync has been run yet.
 */
export async function resolveWebhookOwner(): Promise<string | null> {
  const state = await prisma.stripeSyncState.findFirst({
    select: { ownerId: true },
    orderBy: { lastBackfillAt: 'desc' },
  })
  if (state) return state.ownerId

  const tx = await prisma.transaction.findFirst({
    where: { source: 'stripe' },
    select: { ownerId: true },
  })
  return tx?.ownerId ?? null
}

/**
 * Handles charge.succeeded / charge.updated / charge.refunded.
 * Upserts the income row, fee row (when balance_transaction is expanded),
 * and any refund rows present in the payload. Links to a CRM client by email.
 */
export async function processChargeEvent(
  charge: Stripe.Charge,
  ownerId: string,
): Promise<void> {
  const incomeData = chargeToTransaction(charge, ownerId)
  const incomeId = await upsertTransaction(incomeData)

  const feeData = chargeFeeToTransaction(charge, ownerId)
  const feeId = feeData ? await upsertTransaction(feeData) : null

  const refundIds: string[] = []
  for (const refund of charge.refunds?.data ?? []) {
    const refundData = refundToTransaction(refund, charge, ownerId)
    refundIds.push(await upsertTransaction(refundData))
  }

  const email = incomeData.metadata.counterpartyEmail as string | null
  const stripeCustomerId = incomeData.metadata.stripeCustomerId as string | null
  const txIds = [incomeId, feeId, ...refundIds].filter(Boolean) as string[]
  await linkTransactionsByEmail(ownerId, email, stripeCustomerId, txIds)
}

/**
 * Handles invoice.paid — but ONLY when invoice.charge is null.
 * When invoice.charge is set, charge.succeeded also fires and handles the row,
 * so skipping here prevents double-counting the same payment.
 */
export async function processInvoiceEvent(
  invoice: Stripe.Invoice,
  ownerId: string,
): Promise<void> {
  // In older API versions `invoice.charge` links to the backing charge object.
  // SDK v22 removed this field from the TypeScript type, but Stripe's webhook
  // payload still includes it for card-paid invoices. Read it defensively to
  // avoid double-counting when charge.succeeded also fires for the same payment.
  const backingCharge = (invoice as unknown as { charge?: string | null }).charge
  if (backingCharge) return

  const data = invoiceToTransaction(invoice, ownerId)
  const txId = await upsertTransaction(data)

  const email = data.metadata.counterpartyEmail as string | null
  const stripeCustomerId = data.metadata.stripeCustomerId as string | null
  await linkTransactionsByEmail(ownerId, email, stripeCustomerId, [txId])
}

/**
 * Handles customer.created / customer.updated.
 * Back-fills client.stripeCustomerId when a CRM Client with a matching email exists.
 * Does NOT create new transactions or clients.
 */
export async function processCustomerEvent(
  customer: Stripe.Customer,
  ownerId: string,
): Promise<void> {
  if (!customer.email) return

  const client = await prisma.client.findFirst({
    where: { ownerId, email: customer.email },
    select: { id: true, stripeCustomerId: true },
  })
  if (!client) return

  if (!client.stripeCustomerId) {
    await prisma.client.update({
      where: { id: client.id },
      data: { stripeCustomerId: customer.id },
    })
  }
}

// ─── Backfill ─────────────────────────────────────────────────────────────────

export async function backfillStripe(ownerId: string): Promise<void> {
  await prisma.stripeSyncState.upsert({
    where: { ownerId },
    create: { ownerId, status: 'syncing' },
    update: { status: 'syncing', lastError: null },
  })

  try {
    const stripeClient = await getStripeForOwner(ownerId)
    await stripeClient.charges
      .list({
        limit: 100,
        expand: ['data.balance_transaction', 'data.customer'],
      })
      .autoPagingEach(async (charge: Stripe.Charge) => {
        // Only process succeeded charges
        if (charge.status !== 'succeeded') return

        // ── Income row ────────────────────────────────────────────
        const incomeData = chargeToTransaction(charge, ownerId)
        const incomeId = await upsertTransaction(incomeData)

        // ── Fee expense row ───────────────────────────────────────
        const feeData = chargeFeeToTransaction(charge, ownerId)
        const feeId = feeData ? await upsertTransaction(feeData) : null

        // ── Refund expense rows ───────────────────────────────────
        const refundIds: string[] = []
        for (const refund of charge.refunds?.data ?? []) {
          const refundData = refundToTransaction(refund, charge, ownerId)
          const rid = await upsertTransaction(refundData)
          refundIds.push(rid)
        }

        // ── Client linking via counterparty email ─────────────────
        const email = incomeData.metadata.counterpartyEmail as string | null
        const stripeCustomerId = incomeData.metadata.stripeCustomerId as string | null
        const txIds = [incomeId, feeId, ...refundIds].filter(Boolean) as string[]
        await linkTransactionsByEmail(ownerId, email, stripeCustomerId, txIds)
      })

    await prisma.stripeSyncState.upsert({
      where: { ownerId },
      create: { ownerId, status: 'idle', lastBackfillAt: new Date() },
      update: { status: 'idle', lastBackfillAt: new Date() },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.stripeSyncState.upsert({
      where: { ownerId },
      create: { ownerId, status: 'error', lastError: message },
      update: { status: 'error', lastError: message },
    })
    throw err
  }
}
