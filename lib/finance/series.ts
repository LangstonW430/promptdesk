import { expandRecurring, type BucketableRow } from './calc'
import type { Period } from './types'

/**
 * One point on the finance chart. Replaces the old month-shaped type: the
 * charts now follow the period selector, and "this month" is plotted by day,
 * so a point is not always a month.
 */
export interface SeriesPoint {
  /** Stable identity for React keys and bucket lookup. */
  key: string
  /** Full label, e.g. "Mar 2026" or "12 Mar". Used in the table. */
  label: string
  /** Abbreviated label for the x-axis, e.g. "Mar" or "12". */
  shortLabel: string
  income: number
  expense: number
  net: number
}

export type Granularity = 'day' | 'month' | 'quarter'

export interface Bucket {
  key: string
  label: string
  shortLabel: string
  start: Date
  /** Exclusive. */
  end: Date
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Above this many buckets a month-per-point chart stops being readable. */
const MAX_MONTH_BUCKETS = 24

function monthBucket(year: number, month: number): Bucket {
  return {
    key: `${year}-${month + 1}`,
    label: `${MONTHS[month]} ${year}`,
    shortLabel: MONTHS[month],
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1)),
  }
}

function quarterBucket(year: number, quarter: number): Bucket {
  return {
    key: `${year}-Q${quarter + 1}`,
    label: `Q${quarter + 1} ${year}`,
    shortLabel: `Q${quarter + 1}`,
    start: new Date(Date.UTC(year, quarter * 3, 1)),
    end: new Date(Date.UTC(year, quarter * 3 + 3, 1)),
  }
}

function dayBucket(year: number, month: number, day: number): Bucket {
  return {
    key: `${year}-${month + 1}-${day}`,
    label: `${day} ${MONTHS[month]}`,
    shortLabel: String(day),
    start: new Date(Date.UTC(year, month, day)),
    end: new Date(Date.UTC(year, month, day + 1)),
  }
}

/**
 * The buckets a period is plotted in.
 *
 * The charts used to sit on a fixed six-month window regardless of the period
 * selector, which meant they described a different span from the stat cards
 * directly above them. Granularity now follows the period instead:
 *
 * - **This month** is plotted by day. A single monthly bucket is not a chart —
 *   it is one point, and a line needs at least two. Days are also the only
 *   resolution at which "how is this month going" is a real question.
 * - **This quarter** and **year to date** are plotted by month.
 * - **All time** is plotted by month until the history outgrows what a chart
 *   can show, then by quarter — so the full range stays visible rather than
 *   being truncated, which would silently restart a cumulative total partway
 *   through.
 *
 * Buckets never run past the current day: an empty bucket for a month that has
 * not happened yet reads as a collapse to zero.
 */
export function buildBuckets(
  period: Period,
  now: Date = new Date(),
  earliest?: Date | null,
): { granularity: Granularity; buckets: Bucket[] } {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const today = now.getUTCDate()

  if (period === 'thisMonth') {
    const buckets = Array.from({ length: today }, (_, i) => dayBucket(year, month, i + 1))
    return { granularity: 'day', buckets }
  }

  if (period === 'thisQuarter') {
    const qStart = Math.floor(month / 3) * 3
    const buckets: Bucket[] = []
    for (let m = qStart; m <= month; m++) buckets.push(monthBucket(year, m))
    return { granularity: 'month', buckets }
  }

  if (period === 'ytd') {
    const buckets: Bucket[] = []
    for (let m = 0; m <= month; m++) buckets.push(monthBucket(year, m))
    return { granularity: 'month', buckets }
  }

  // allTime — anchored to the first transaction, or this month when there is
  // no history at all.
  const from = earliest ?? new Date(Date.UTC(year, month, 1))
  const fromYear = from.getUTCFullYear()
  const fromMonth = from.getUTCMonth()
  const totalMonths = (year - fromYear) * 12 + (month - fromMonth) + 1

  if (totalMonths <= MAX_MONTH_BUCKETS) {
    const buckets: Bucket[] = []
    for (let i = 0; i < totalMonths; i++) {
      const t = fromMonth + i
      buckets.push(monthBucket(fromYear + Math.floor(t / 12), t % 12))
    }
    return { granularity: 'month', buckets }
  }

  const buckets: Bucket[] = []
  let q = Math.floor(fromMonth / 3)
  let y = fromYear
  const lastQ = Math.floor(month / 3)
  while (y < year || (y === year && q <= lastQ)) {
    buckets.push(quarterBucket(y, q))
    q += 1
    if (q > 3) { q = 0; y += 1 }
  }
  return { granularity: 'quarter', buckets }
}

/**
 * Sums transactions into the given buckets.
 *
 * Standing charges are expanded into their occurrences first, using the same
 * definition every other figure on the page reads, so a recurring fee lands in
 * each period it actually applies to rather than only its first.
 */
export function bucketSeries(
  rows: ReadonlyArray<BucketableRow>,
  buckets: ReadonlyArray<Bucket>,
): SeriesPoint[] {
  const points: SeriesPoint[] = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    shortLabel: b.shortLabel,
    income: 0,
    expense: 0,
    net: 0,
  }))
  if (buckets.length === 0) return points

  const from = buckets[0].start
  const to = new Date(buckets[buckets.length - 1].end.getTime() - 1)

  // Bucket boundaries are contiguous and ascending, so a binary search beats
  // scanning every bucket per occurrence once a long history is on screen.
  function indexFor(t: number): number {
    let lo = 0
    let hi = buckets.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (t < buckets[mid].start.getTime()) hi = mid - 1
      else if (t >= buckets[mid].end.getTime()) lo = mid + 1
      else return mid
    }
    return -1
  }

  for (const r of expandRecurring(rows, from, to)) {
    const i = indexFor(new Date(r.occurredAt).getTime())
    if (i === -1) continue
    if (r.type === 'income') points[i].income += r.amount
    else points[i].expense += r.amount
  }

  for (const p of points) p.net = p.income - p.expense
  return points
}
