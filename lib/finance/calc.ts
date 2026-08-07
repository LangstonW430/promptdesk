import type {
  Period,
  RecurringFrequency,
  FinancialSummary,
  MonthlyStat,
  CategoryStat,
  ClientIncomeStat,
} from './types'

// ─── Period boundaries ────────────────────────────────────────────────────────

/**
 * Returns { from, to } date range for the given period using UTC.
 * `to` is the exclusive upper bound (start of the next period).
 * Both are null for allTime.
 */
export function getPeriodBoundaries(
  period: Period,
  now: Date = new Date(),
): { from: Date | null; to: Date | null } {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()  // 0-indexed

  switch (period) {
    case 'thisMonth':
      return {
        from: new Date(Date.UTC(year, month, 1)),
        to: new Date(Date.UTC(year, month + 1, 1)),
      }
    case 'thisQuarter': {
      const qStart = Math.floor(month / 3) * 3
      return {
        from: new Date(Date.UTC(year, qStart, 1)),
        to: new Date(Date.UTC(year, qStart + 3, 1)),
      }
    }
    case 'ytd':
      return {
        from: new Date(Date.UTC(year, 0, 1)),
        to: new Date(Date.UTC(year + 1, 0, 1)),
      }
    case 'allTime':
      return { from: null, to: null }
  }
}

// ─── Sum income / expense / net ───────────────────────────────────────────────

export function sumFinancials(
  rows: ReadonlyArray<{ type: string; amount: number }>,
): FinancialSummary {
  let totalIncome = 0
  let totalExpense = 0
  for (const r of rows) {
    if (r.type === 'income') totalIncome += r.amount
    else totalExpense += r.amount
  }
  return { totalIncome, totalExpense, net: totalIncome - totalExpense }
}

// ─── Monthly bucketing ────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Months between two year/month pairs. Negative when `to` precedes `from`. */
function monthsBetween(
  fromYear: number, fromMonth: number,
  toYear: number, toMonth: number,
): number {
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

/** How many months apart two consecutive charges are, for a given cadence. */
function monthsPerPeriod(frequency: string | null | undefined): number {
  if (frequency === 'quarterly') return 3
  if (frequency === 'annual') return 12
  return 1
}

export interface BucketableRow {
  type: string
  amount: number
  /** ISO date string. */
  occurredAt: string
  /**
   * A recurring row is a standing charge — it repeats from `occurredAt` at its
   * cadence rather than landing in one month.
   */
  isRecurring?: boolean
  frequency?: string | null
  /** ISO date string. Null/absent means the charge is still running. */
  recurrenceEndedAt?: string | null
}

/**
 * Produces `months` consecutive monthly buckets ending in the current month,
 * summing income and expense for each. Transactions outside the window are
 * ignored.
 *
 * Recurring rows repeat. A monthly hosting fee entered once in March is charged
 * again every month after, so it belongs in every bucket from March onward —
 * previously it appeared in March alone and every later month understated the
 * real cost. Quarterly and annual rows land in the months they are actually
 * charged (March, June, September…) rather than being spread thinly across all
 * of them: this chart is cash in and out per month, so a $300 quarterly bill is
 * $300 in one month and nothing in the next two. MRR is where that same charge
 * gets normalised to a rate.
 *
 * A recurrence never starts before `occurredAt` and stops after
 * `recurrenceEndedAt`, so ending one leaves the months it did apply to intact.
 */
export function bucketByMonth(
  rows: ReadonlyArray<BucketableRow>,
  months: number,
  now: Date = new Date(),
): MonthlyStat[] {
  const endYear = now.getUTCFullYear()
  const endMonth = now.getUTCMonth()  // 0-indexed

  // Build bucket array oldest → newest
  const buckets: MonthlyStat[] = []
  for (let i = months - 1; i >= 0; i--) {
    let m = endMonth - i
    let y = endYear
    while (m < 0) { m += 12; y -= 1 }
    buckets.push({
      year: y,
      month: m + 1,  // 1-indexed
      label: `${MONTH_LABELS[m]} ${y}`,
      income: 0,
      expense: 0,
      net: 0,
    })
  }

  // Index by "year-month" for O(1) lookup
  const idx = new Map(buckets.map((b) => [`${b.year}-${b.month}`, b]))

  const first = buckets[0]
  const last = buckets[buckets.length - 1]

  function add(bucket: MonthlyStat | undefined, row: BucketableRow) {
    if (!bucket) return
    if (row.type === 'income') bucket.income += row.amount
    else bucket.expense += row.amount
  }

  for (const r of rows) {
    const d = new Date(r.occurredAt)
    const startYear = d.getUTCFullYear()
    const startMonth = d.getUTCMonth() + 1

    if (!r.isRecurring) {
      add(idx.get(`${startYear}-${startMonth}`), r)
      continue
    }

    const step = monthsPerPeriod(r.frequency)

    // Walk the charge dates that fall inside the window. Start at the first
    // occurrence on or after the window opens, so a charge running for years
    // costs a handful of iterations rather than one per month since it began.
    const offsetToWindow = monthsBetween(startYear, startMonth, first.year, first.month)
    const firstIndex = offsetToWindow <= 0 ? 0 : Math.ceil(offsetToWindow / step)

    // ...and stop at the window's end, or when the recurrence ended.
    let lastIndex = Math.floor(
      monthsBetween(startYear, startMonth, last.year, last.month) / step,
    )
    if (r.recurrenceEndedAt) {
      const e = new Date(r.recurrenceEndedAt)
      // Inclusive of the month it ended in — a charge cancelled mid-month was
      // still charged that month.
      const endIndex = Math.floor(
        monthsBetween(startYear, startMonth, e.getUTCFullYear(), e.getUTCMonth() + 1) / step,
      )
      lastIndex = Math.min(lastIndex, endIndex)
    }

    for (let i = Math.max(firstIndex, 0); i <= lastIndex; i++) {
      const total = (startMonth - 1) + i * step
      add(idx.get(`${startYear + Math.floor(total / 12)}-${(total % 12) + 1}`), r)
    }
  }

  for (const b of buckets) b.net = b.income - b.expense
  return buckets
}

// ─── Group by category ────────────────────────────────────────────────────────

export function groupByCategory(
  rows: ReadonlyArray<{ type: string; amount: number; category: string }>,
): CategoryStat[] {
  const map = new Map<string, CategoryStat>()
  for (const r of rows) {
    const existing = map.get(r.category)
    if (existing) {
      existing.total += r.amount
      existing.count += 1
    } else {
      map.set(r.category, { category: r.category, total: r.amount, count: 1 })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

// ─── MRR ─────────────────────────────────────────────────────────────────────

export interface MRRSummary {
  mrr: number           // sum of recurring income this month (normalized)
  expenses: number      // sum of all expenses this month
  passiveIncome: number // mrr - expenses
}

/** Converts a recurring transaction amount to its monthly equivalent. */
function toMonthly(amount: number, frequency: RecurringFrequency | null | undefined): number {
  if (!frequency || frequency === 'monthly') return amount
  if (frequency === 'quarterly') return amount / 3
  if (frequency === 'annual') return amount / 12
  return amount
}

/**
 * Calculates MRR from a set of income rows, normalizing quarterly/annual amounts.
 * Only rows where type === 'income' and isRecurring === true are counted.
 */
export function calculateMRR(
  rows: ReadonlyArray<{ type: string; amount: number; isRecurring: boolean; frequency?: string | null }>,
): number {
  let mrr = 0
  for (const r of rows) {
    if (r.type === 'income' && r.isRecurring) {
      mrr += toMonthly(r.amount, r.frequency as RecurringFrequency | null)
    }
  }
  return mrr
}

export function calculateMRRSummary(
  rows: ReadonlyArray<{ type: string; amount: number; isRecurring: boolean; frequency?: string | null }>,
): MRRSummary {
  let mrr = 0
  let expenses = 0
  for (const r of rows) {
    if (r.type === 'income' && r.isRecurring) {
      mrr += toMonthly(r.amount, r.frequency as RecurringFrequency | null)
    }
    if (r.type === 'expense') expenses += r.amount
  }
  return { mrr, expenses, passiveIncome: mrr - expenses }
}

// ─── Group by client (income only) ───────────────────────────────────────────

export function groupByClient(
  rows: ReadonlyArray<{
    type: string
    amount: number
    clientId: string | null
    clientName: string | null
  }>,
): ClientIncomeStat[] {
  const map = new Map<string | null, ClientIncomeStat>()
  for (const r of rows) {
    if (r.type !== 'income') continue
    const key = r.clientId ?? '__none__'
    const existing = map.get(key)
    if (existing) {
      existing.total += r.amount
    } else {
      map.set(key, {
        clientId: r.clientId,
        clientName: r.clientName,
        total: r.amount,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

// ─── Category tail folding ────────────────────────────────────────────────────

/** Label used for the folded remainder. Not a real category. */
export const OTHER_CATEGORY = 'Other'

/**
 * Caps a category breakdown at `limit` coloured slices, folding everything past
 * that into a single "Other" bucket.
 *
 * The chart palette has a fixed number of slots assigned in order. Wrapping back
 * round to slot 1 for the ninth category would give two categories the same
 * colour in the same chart, which is exactly the confusion the palette ordering
 * exists to prevent. Folding keeps the total honest — the bucket carries the sum
 * of everything it absorbed — while capping how many colours have to stay
 * distinguishable.
 *
 * Assumes `stats` is sorted descending by total, which `groupByCategory`
 * guarantees. A pre-existing "Other" category merges into the bucket rather than
 * producing two rows with the same label.
 */
export function foldCategoryTail(
  stats: ReadonlyArray<CategoryStat>,
  limit: number,
): CategoryStat[] {
  if (limit < 1) return []
  // Nothing to fold, and no pre-existing "Other" that would collide.
  if (stats.length <= limit && !stats.some((s) => s.category === OTHER_CATEGORY)) {
    return stats.slice()
  }

  const head: CategoryStat[] = []
  let otherTotal = 0
  let otherCount = 0

  for (const stat of stats) {
    // "Other" always folds, wherever it sorted, so the label is never duplicated.
    if (head.length < limit && stat.category !== OTHER_CATEGORY) {
      head.push({ ...stat })
    } else {
      otherTotal += stat.total
      otherCount += stat.count
    }
  }

  if (otherCount === 0) return head
  return [...head, { category: OTHER_CATEGORY, total: otherTotal, count: otherCount }]
}
