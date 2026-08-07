import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { financeTag } from '@/lib/cache-tags'
import { buildBuckets, bucketSeries, type SeriesPoint, type Granularity } from './series'
import { getPeriodBoundaries } from './calc'
import type { Period } from './types'

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

// ─── Period series ───────────────────────────────────────────────────────────

export interface PeriodSeries {
  points: SeriesPoint[]
  granularity: Granularity
}

/**
 * The charted series for the selected period.
 *
 * This replaced a fixed six-month window that ignored the period selector
 * entirely, so the chart described a different span from the stat cards
 * directly above it. Granularity is chosen by `buildBuckets`; see there for
 * why "this month" is plotted by day.
 */
export const getPeriodSeries = ownerCache(
  'finance-series',
  async (ownerId: string, period: Period): Promise<PeriodSeries> => {
    const { from } = getPeriodBoundaries(period)

    // allTime anchors its buckets to the first transaction, so it has to be
    // asked for. Every other period has fixed bounds and skips the query.
    let earliest: Date | null = null
    if (period === 'allTime') {
      const first = await prisma.transaction.findFirst({
        where: { ownerId },
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true },
      })
      earliest = first?.occurredAt ?? null
    }

    const { granularity, buckets } = buildBuckets(period, new Date(), earliest)
    if (buckets.length === 0) return { points: [], granularity }

    const windowStart = buckets[0].start

    // A standing charge that began before the window still applies inside it,
    // so recurring rows cannot be excluded by date the way one-off rows can.
    const rows = await prisma.transaction.findMany({
      where: {
        OR: [
          { ownerId, occurredAt: { gte: from ?? windowStart } },
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

    return {
      points: bucketSeries(
        rows.map((r) => ({
          type: r.type,
          amount: Number(r.amount),
          occurredAt: r.occurredAt.toISOString(),
          isRecurring: r.isRecurring,
          frequency: r.frequency,
          recurrenceEndedAt: r.recurrenceEndedAt?.toISOString() ?? null,
        })),
        buckets,
      ),
      granularity,
    }
  },
)

// getMRRSummary and getIncomeByClient were removed. Both were cached wrappers
// with no callers: MRR is served by getActiveMRR, which now counts manually
// entered standing charges as well as Stripe subscriptions, and the finance
// page derives its income-by-client breakdown from the rows it already loads.
// Their reducers (calculateMRR, groupByClient) are still in lib/finance/calc.
