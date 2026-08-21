import type {
  Period,
  RecurringFrequency,
  FinancialSummary,
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

export interface RecurringRow {
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

export interface BucketableRow extends RecurringRow {
  type: string
  amount: number
}

/**
 * Every date a charge falls on inside `[from, to]`, inclusive of both months.
 *
 * The single definition of when a standing charge applies. The monthly chart,
 * the period totals and the transactions table all read it, so a hosting fee
 * cannot appear six times in one and once in another — which is exactly what
 * happened when only the chart knew about recurrence.
 *
 * Occurrences keep the day of the month they started on — a fee begun on the
 * 15th recurs on the 15th — clamped down in months too short for it, so a
 * charge dated the 31st falls on the 28th of February rather than sliding into
 * March. The day matters as soon as anything buckets by day.
 *
 * `projectUntil` caps how far a standing charge is projected forward, and
 * applies to nothing else. Callers pass today's month-end so the list does not
 * claim money that has not been spent yet — but a one-off the user dated in
 * the future is a row they actually entered, and it stays visible as long as
 * it falls inside the window. Collapsing the two used to hide it completely.
 */
export function occurrenceDates(
  row: RecurringRow,
  from: Date,
  to: Date,
  projectUntil: Date = to,
): Date[] {
  const start = new Date(row.occurredAt)
  const startYear = start.getUTCFullYear()
  const startMonth = start.getUTCMonth() // 0-indexed
  const startDay = start.getUTCDate()

  if (!row.isRecurring) {
    return start >= from && start <= to ? [start] : []
  }

  const step = monthsPerPeriod(row.frequency)

  // Projections never run past the window, nor past the caller's horizon.
  const horizon = projectUntil < to ? projectUntil : to

  // Last month the charge applies: the horizon, or when it stopped —
  // inclusive of that month, since a mid-month cancellation was still billed.
  let endIndex = Math.floor(
    monthsBetween(startYear, startMonth, horizon.getUTCFullYear(), horizon.getUTCMonth()) / step,
  )
  if (row.recurrenceEndedAt) {
    const ended = new Date(row.recurrenceEndedAt)
    endIndex = Math.min(
      endIndex,
      Math.floor(
        monthsBetween(startYear, startMonth, ended.getUTCFullYear(), ended.getUTCMonth()) / step,
      ),
    )
  }

  // Start at the first occurrence inside the window rather than walking every
  // month since the charge began — one running since 2024 costs a few steps.
  const offset = monthsBetween(startYear, startMonth, from.getUTCFullYear(), from.getUTCMonth())
  const startIndex = Math.max(0, offset <= 0 ? 0 : Math.ceil(offset / step))

  const dates: Date[] = []
  for (let i = startIndex; i <= endIndex; i++) {
    const total = startMonth + i * step
    const y = startYear + Math.floor(total / 12)
    const m = total % 12
    // Day 0 of the next month is the last day of this one.
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const d = new Date(Date.UTC(y, m, Math.min(startDay, daysInMonth)))
    if (d >= from && d <= horizon) dates.push(d)
  }
  return dates
}

/**
 * Expands standing charges into one entry per occurrence within the window,
 * leaving one-off rows untouched.
 *
 * `isProjected` marks the repeats: they are derived, so a repeat carries no
 * figures of its own to change and nothing may write to one directly.
 *
 * `seriesStartAt` is the date of the row the occurrence came from, kept on
 * every entry because `occurredAt` on a repeat is the projected date, not a
 * date that exists in the database. Editing a standing charge from one of its
 * repeats — the only rows on screen once the period moves past the month it
 * began in — needs the real start date, or saving the form would move the
 * charge's beginning to whichever month happened to be in view.
 */
export function expandRecurring<T extends RecurringRow>(
  rows: ReadonlyArray<T>,
  from: Date,
  to: Date,
  projectUntil: Date = to,
): Array<T & { occurredAt: string; isProjected: boolean; seriesStartAt: string }> {
  const out: Array<T & { occurredAt: string; isProjected: boolean; seriesStartAt: string }> = []
  for (const row of rows) {
    for (const date of occurrenceDates(row, from, to, projectUntil)) {
      const iso = date.toISOString()
      out.push({
        ...row,
        occurredAt: row.isRecurring ? iso : row.occurredAt,
        // The charge on its original date is the real row; the repeats are not.
        isProjected: row.isRecurring === true && iso.slice(0, 7) !== row.occurredAt.slice(0, 7),
        seriesStartAt: row.occurredAt,
      })
    }
  }
  return out
}

// bucketByMonth was removed. It built its own fixed-width month window, which
// is what kept the chart on six months regardless of the period selector.
// lib/finance/series.ts now builds buckets from the period and fills them with
// bucketSeries; both read the same occurrenceDates/expandRecurring above, so
// recurrence still behaves identically.

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

// ─── Cumulative view ─────────────────────────────────────────────────────────

/**
 * Turns per-month figures into running totals across the charted window.
 *
 * Each month reports everything earned or spent up to and including it, rather
 * than that month alone. It answers a different question from the per-month
 * series — "am I ahead over this stretch" instead of "how did March go" — and
 * a rising-then-flattening cumulative net is far easier to read off a running
 * total than off six separate bars.
 *
 * The running total starts at the beginning of the window, not at the beginning
 * of time: the chart shows a fixed span, so the figures are cumulative *within
 * the period on screen*.
 *
 * Net stays the difference of the two running totals, which is the same thing
 * as the running total of the monthly nets — so the three series remain
 * consistent with each other however the reader adds them up.
 */
export function toCumulative<T extends { income: number; expense: number; net: number }>(
  rows: ReadonlyArray<T>,
): T[] {
  let income = 0
  let expense = 0
  return rows.map((r) => {
    income += r.income
    expense += r.expense
    return { ...r, income, expense, net: income - expense }
  })
}
