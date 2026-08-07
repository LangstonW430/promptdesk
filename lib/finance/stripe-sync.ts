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
import { getPeriodBoundaries } from './calc'
import type { RecurringFrequency } from './types'
import {
  chargeToTransaction,
  chargeFeeToTransaction,
  refundToTransaction,
  invoiceToTransaction,
  isExpandedCustomer,
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
      isRecurring: data.isRecurring,
      metadata: data.metadata as unknown as Prisma.InputJsonValue,
    },
    update: {
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      category: data.category,
      occurredAt: data.occurredAt,
      isRecurring: data.isRecurring,
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
// ─── Active MRR from live subscriptions ──────────────────────────────────────

export interface SubscriptionLine {
  subscriptionId: string
  customerName: string | null
  priceName: string | null
  interval: string       // e.g. "month", "every 3 months"
  monthlyAmount: number
}

export interface RecurringLine {
  id: string
  type: 'income' | 'expense'
  label: string
  category: string
  frequency: RecurringFrequency
  /** The amount as entered, at its own cadence. */
  amount: number
  /** That amount normalised to a monthly rate. */
  monthlyAmount: number
}

export interface ActiveMRRResult {
  configured: boolean       // false when no Stripe key is saved
  permissionError: boolean  // true when key lacks Subscriptions: Read
  gross: number             // Stripe subscriptions + manual recurring income, monthly
  estimatedFees: number     // 2.9% + $0.30 per sub (exposed for breakdown display)
  monthlyExpenses: number   // one-off expenses this month + recurring + estimatedFees
  net: number               // gross - monthlyExpenses
  subscriptionCount: number
  subscriptions: SubscriptionLine[]
  /** Manually entered recurring income, normalised to a monthly rate. */
  manualRecurringIncome: number
  /** Manually entered recurring expense, normalised to a monthly rate. */
  manualRecurringExpense: number
  /** Each standing charge individually, so the breakdown can name them. */
  recurringLines: RecurringLine[]
  /** True when there is anything to show at all — Stripe or manual recurring. */
  hasData: boolean
}

/**
 * Manually entered standing charges, normalised to monthly rates.
 *
 * These were invisible to MRR, which only ever asked Stripe. A hosting fee
 * entered by hand is a recurring cost whether or not Stripe knows about it, and
 * a retainer invoiced manually is recurring income — the panel reported neither.
 * A recurrence that has ended no longer counts toward the current rate.
 */
async function getManualRecurringRates(
  ownerId: string,
  now: Date,
): Promise<{ income: number; expense: number; lines: RecurringLine[] }> {
  const rows = await prisma.transaction.findMany({
    where: {
      ownerId,
      source: 'manual',
      isRecurring: true,
      OR: [{ recurrenceEndedAt: null }, { recurrenceEndedAt: { gte: now } }],
    },
    select: {
      id: true, type: true, amount: true, frequency: true,
      description: true, category: true,
    },
    orderBy: { amount: 'desc' },
  })

  let income = 0
  let expense = 0
  const lines: RecurringLine[] = []

  for (const r of rows) {
    // Quarterly and annual charges are divided down, so the panel reads as a
    // rate per month rather than mixing cadences.
    const divisor = r.frequency === 'quarterly' ? 3 : r.frequency === 'annual' ? 12 : 1
    const monthly = Math.round((Number(r.amount) / divisor) * 100) / 100
    if (r.type === 'income') income += monthly
    else expense += monthly

    lines.push({
      id: r.id,
      type: r.type as 'income' | 'expense',
      // Named individually rather than summed into one "Recurring expenses"
      // row: a breakdown whose whole point is itemising what makes up a total
      // is useless if it collapses everything into a single line.
      label: r.description || r.category,
      category: r.category,
      frequency: (r.frequency as RecurringFrequency | null) ?? 'monthly',
      amount: Number(r.amount),
      monthlyAmount: monthly,
    })
  }

  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    lines,
  }
}

function normalizeToMonthly(
  amount: number,
  interval: string,
  intervalCount: number,
): number {
  const perInterval = amount / intervalCount
  switch (interval) {
    case 'day':   return perInterval * 30.4
    case 'week':  return perInterval * 4.33
    case 'month': return perInterval
    case 'year':  return perInterval / 12
    default:      return perInterval
  }
}

/**
 * Returns true MRR by querying Stripe for currently active subscriptions.
 * Requires Subscriptions: Read on the restricted key.
 * Returns configured: false when no key is set, permissionError: true when
 * the key exists but lacks that permission.
 */
export async function getActiveMRR(ownerId: string): Promise<ActiveMRRResult> {
  const { from: expFrom, to: expTo } = getPeriodBoundaries('thisMonth')
  // Exclude Stripe fee rows (externalType = 'fee') — those are per-charge and dated
  // when the charge occurred, which may be outside the current month. Estimated
  // subscription fees are added separately below so they stay in sync with gross MRR.
  // Recurring rows are excluded here and counted at their monthly rate instead:
  // a standing charge applies every month regardless of the one date it carries,
  // so matching it by `occurredAt` would count it in its first month only.
  const [expenseAgg, manualRecurring] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        ownerId,
        type: 'expense',
        isRecurring: false,
        occurredAt: { gte: expFrom!, lt: expTo! },
        OR: [{ externalType: null }, { externalType: { not: 'fee' } }],
      },
      _sum: { amount: true },
    }),
    getManualRecurringRates(ownerId, new Date()),
  ])
  const oneOffExpenses = Math.round(Number(expenseAgg._sum.amount ?? 0) * 100) / 100
  const otherExpenses = Math.round((oneOffExpenses + manualRecurring.expense) * 100) / 100

  // With no Stripe key the panel is not empty any more — manually entered
  // standing charges are real recurring figures and are all this returns.
  const empty: ActiveMRRResult = {
    configured: false,
    permissionError: false,
    gross: manualRecurring.income,
    estimatedFees: 0,
    monthlyExpenses: otherExpenses,
    net: Math.round((manualRecurring.income - otherExpenses) * 100) / 100,
    subscriptionCount: 0,
    subscriptions: [],
    manualRecurringIncome: manualRecurring.income,
    manualRecurringExpense: manualRecurring.expense,
    recurringLines: manualRecurring.lines,
    hasData: manualRecurring.income > 0 || manualRecurring.expense > 0 || otherExpenses > 0,
  }

  let stripeClient: Awaited<ReturnType<typeof getStripeForOwner>>
  try {
    stripeClient = await getStripeForOwner(ownerId)
  } catch {
    return empty  // no key configured
  }

  let gross = 0
  let count = 0
  const lines: SubscriptionLine[] = []
  try {
    await stripeClient.subscriptions
      .list({ status: 'active', limit: 100, expand: ['data.items.data.price', 'data.customer'] })
      .autoPagingEach((sub) => {
        const customerName = isExpandedCustomer(sub.customer as Stripe.Charge['customer'])
          ? ((sub.customer as Stripe.Customer).name ?? (sub.customer as Stripe.Customer).email ?? null)
          : null
        for (const item of sub.items.data) {
          const price = item.price
          const unitAmount = price.unit_amount ?? 0
          const interval = price.recurring?.interval ?? 'month'
          const intervalCount = price.recurring?.interval_count ?? 1
          const qty = item.quantity ?? 1
          const monthly = normalizeToMonthly(unitAmount * qty, interval, intervalCount) / 100
          gross += monthly
          lines.push({
            subscriptionId: sub.id,
            customerName,
            priceName: price.nickname ?? null,
            interval: intervalCount > 1 ? `every ${intervalCount} ${interval}s` : interval,
            monthlyAmount: Math.round(monthly * 100) / 100,
          })
        }
        count += 1
      })
  } catch (err) {
    const isPermErr =
      err instanceof Error &&
      (err.message.includes('permission') ||
        err.message.includes('StripePermissionError') ||
        (err as { statusCode?: number }).statusCode === 403)
    return { ...empty, configured: true, permissionError: isPermErr }
  }

  // Stripe standard rate: 2.9% + $0.30 per subscription per month. Charged on
  // Stripe's gross only, so it is computed before manual income is added in.
  const estimatedFees = Math.round((gross * 0.029 + count * 0.3) * 100) / 100
  const monthlyExpenses = Math.round((otherExpenses + estimatedFees) * 100) / 100
  const totalGross = Math.round((gross + manualRecurring.income) * 100) / 100

  return {
    configured: true,
    permissionError: false,
    gross: totalGross,
    estimatedFees,
    monthlyExpenses,
    net: Math.round((totalGross - monthlyExpenses) * 100) / 100,
    subscriptionCount: count,
    subscriptions: lines,
    manualRecurringIncome: manualRecurring.income,
    manualRecurringExpense: manualRecurring.expense,
    recurringLines: manualRecurring.lines,
    hasData: true,
  }
}

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
        // data.payment_intent.invoice: canonical path in API versions 2022-11-15+
        //   (codename versions), where invoice moved off Charge to PaymentIntent.
        // data.invoice: kept for backward compat with older API versions / webhook payloads.
        expand: ['data.balance_transaction', 'data.customer', 'data.invoice', 'data.payment_intent.invoice'],
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
