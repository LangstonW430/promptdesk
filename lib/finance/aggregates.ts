import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { financeTag } from '@/lib/cache-tags'
import {
  getPeriodBoundaries,
  bucketByMonth,
  groupByClient,
  calculateMRRSummary,
} from './calc'
import type { Period, MonthlyStat, ClientIncomeStat, MRRSummary } from './types'

function dateFilter(from: Date | null, to: Date | null) {
  if (!from && !to) return {}
  return {
    occurredAt: {
      ...(from && { gte: from }),
      ...(to && { lt: to }),
    },
  }
}

/**
 * Wraps an owner-scoped query in `unstable_cache` with a per-owner key and a
 * per-owner tag.
 *
 * These previously shared a single static key part (e.g. `['finance-summary']`)
 * and carried no tags at all. Next.js does fold the call arguments into the
 * cache key, so tenants were not actually colliding — but that isolation was
 * implicit in framework behaviour rather than stated, which is a bad thing to
 * rely on. Putting `ownerId` in the key part makes it explicit, and the tag is
 * what lets server actions actually evict these on mutation.
 */
function ownerCache<A extends unknown[], R>(
  name: string,
  fn: (ownerId: string, ...args: A) => Promise<R>,
): (ownerId: string, ...args: A) => Promise<R> {
  return (ownerId, ...args) =>
    unstable_cache((...inner: A) => fn(ownerId, ...inner), [name, ownerId], {
      revalidate: 60,
      tags: [financeTag(ownerId)],
    })(...args)
}

// The finance page derives its period summary and expense-by-category
// breakdown from the transaction rows it already loads for the table, using
// `sumFinancials` / `groupByCategory` directly. The cached aggregate wrappers
// that used to live here re-ran the same owner+period scan to produce those
// two values, so they were removed rather than left as unused exports.

// ─── Monthly series ───────────────────────────────────────────────────────────

export const getMonthlySeries = ownerCache(
  'finance-monthly',
  async (ownerId: string, months: number): Promise<MonthlyStat[]> => {
    // Fetch enough history to fill all buckets
    const windowStart = new Date()
    windowStart.setUTCMonth(windowStart.getUTCMonth() - (months - 1))
    windowStart.setUTCDate(1)
    windowStart.setUTCHours(0, 0, 0, 0)

    // Recurring rows are standing charges that repeat into the window from
    // whenever they started, so they cannot be filtered out by date the way
    // one-off rows can — a hosting fee begun two years ago still applies to
    // every month on this chart.
    const rows = await prisma.transaction.findMany({
      where: {
        OR: [
          { ownerId, occurredAt: { gte: windowStart } },
          { ownerId, isRecurring: true },
        ],
      },
      select: {
        type: true,
        amount: true,
        occurredAt: true,
        isRecurring: true,
        frequency: true,
        recurrenceEndedAt: true,
      },
    })

    return bucketByMonth(
      rows.map((r) => ({
        type: r.type,
        amount: Number(r.amount),
        occurredAt: r.occurredAt.toISOString(),
        isRecurring: r.isRecurring,
        frequency: r.frequency,
        recurrenceEndedAt: r.recurrenceEndedAt?.toISOString() ?? null,
      })),
      months,
    )
  },
)

// ─── MRR summary ─────────────────────────────────────────────────────────────

export const getMRRSummary = ownerCache(
  'finance-mrr',
  async (ownerId: string): Promise<MRRSummary> => {
    const { from, to } = getPeriodBoundaries('thisMonth')
    const rows = await prisma.transaction.findMany({
      where: { ownerId, ...dateFilter(from, to) },
      select: { type: true, amount: true, isRecurring: true, frequency: true },
    })
    return calculateMRRSummary(
      rows.map((r) => ({
        type: r.type,
        amount: Number(r.amount),
        isRecurring: r.isRecurring,
        frequency: r.frequency,
      })),
    )
  },
)

// ─── Income by client ─────────────────────────────────────────────────────────

export const getIncomeByClient = ownerCache(
  'finance-income-client',
  async (ownerId: string, period: Period): Promise<ClientIncomeStat[]> => {
    const { from, to } = getPeriodBoundaries(period)
    const rows = await prisma.transaction.findMany({
      where: { ownerId, type: 'income', ...dateFilter(from, to) },
      select: {
        type: true,
        amount: true,
        clientId: true,
        client: { select: { companyName: true, contactName: true } },
      },
    })
    return groupByClient(
      rows.map((r) => ({
        type: r.type,
        amount: Number(r.amount),
        clientId: r.clientId,
        clientName: r.client
          ? (r.client.companyName ?? r.client.contactName ?? 'Unknown')
          : null,
      })),
    )
  },
)
