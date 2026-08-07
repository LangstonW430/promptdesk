import { describe, it, expect } from 'vitest'
import { bucketByMonth, expandRecurring } from '../calc'

// Fixed "now" so the six-month window is Mar–Aug 2026.
const NOW = new Date('2026-08-15T12:00:00Z')
const WINDOW = 6

function months(rows: Parameters<typeof bucketByMonth>[0]) {
  return bucketByMonth(rows, WINDOW, NOW)
}

function expenseByLabel(rows: Parameters<typeof bucketByMonth>[0]) {
  return Object.fromEntries(months(rows).map((b) => [b.label, b.expense]))
}

const hosting = {
  type: 'expense',
  amount: 20,
  occurredAt: '2026-03-01T00:00:00Z',
  isRecurring: true,
  frequency: 'monthly',
}

describe('bucketByMonth — one-off rows', () => {
  it('lands in the month it occurred and nowhere else', () => {
    const byLabel = expenseByLabel([
      { type: 'expense', amount: 500, occurredAt: '2026-05-09T00:00:00Z' },
    ])
    expect(byLabel['May 2026']).toBe(500)
    expect(byLabel['Apr 2026']).toBe(0)
    expect(byLabel['Jun 2026']).toBe(0)
  })

  it('ignores rows outside the window', () => {
    const total = months([
      { type: 'expense', amount: 999, occurredAt: '2025-01-04T00:00:00Z' },
    ]).reduce((s, b) => s + b.expense, 0)
    expect(total).toBe(0)
  })
})

describe('bucketByMonth — recurring rows', () => {
  it('charges a monthly fee in every month from its start', () => {
    // The reported bug: a hosting fee entered once showed up in March alone.
    expect(expenseByLabel([hosting])).toEqual({
      'Mar 2026': 20,
      'Apr 2026': 20,
      'May 2026': 20,
      'Jun 2026': 20,
      'Jul 2026': 20,
      'Aug 2026': 20,
    })
  })

  it('does not charge months before it started', () => {
    const byLabel = expenseByLabel([{ ...hosting, occurredAt: '2026-06-10T00:00:00Z' }])
    expect(byLabel['May 2026']).toBe(0)
    expect(byLabel['Jun 2026']).toBe(20)
    expect(byLabel['Aug 2026']).toBe(20)
  })

  it('still applies when it started long before the window opened', () => {
    // Two years of prior months must not be walked, and every month in view
    // must still be charged.
    const byLabel = expenseByLabel([{ ...hosting, occurredAt: '2024-01-01T00:00:00Z' }])
    expect(Object.values(byLabel)).toEqual([20, 20, 20, 20, 20, 20])
  })

  it('charges a quarterly fee only in the months it actually falls', () => {
    // Cash flow, not amortisation: $300 lands whole in one month, and the two
    // after it are genuinely zero. MRR is where this gets divided by three.
    expect(expenseByLabel([
      { ...hosting, amount: 300, frequency: 'quarterly', occurredAt: '2026-03-01T00:00:00Z' },
    ])).toEqual({
      'Mar 2026': 300,
      'Apr 2026': 0,
      'May 2026': 0,
      'Jun 2026': 300,
      'Jul 2026': 0,
      'Aug 2026': 0,
    })
  })

  it('charges an annual fee once a year, not every month', () => {
    const byLabel = expenseByLabel([
      { ...hosting, amount: 1200, frequency: 'annual', occurredAt: '2025-07-01T00:00:00Z' },
    ])
    expect(byLabel['Jul 2026']).toBe(1200)
    expect(byLabel['Jun 2026']).toBe(0)
    expect(byLabel['Aug 2026']).toBe(0)
  })

  it('treats a missing frequency as monthly', () => {
    const byLabel = expenseByLabel([{ ...hosting, frequency: null }])
    expect(byLabel['Aug 2026']).toBe(20)
  })

  it('stops after the recurrence ended, keeping earlier months intact', () => {
    // Ending a charge must not rewrite the months it did apply to.
    expect(expenseByLabel([
      { ...hosting, recurrenceEndedAt: '2026-05-20' },
    ])).toEqual({
      'Mar 2026': 20,
      'Apr 2026': 20,
      'May 2026': 20,   // cancelled mid-month; that month was still charged
      'Jun 2026': 0,
      'Jul 2026': 0,
      'Aug 2026': 0,
    })
  })

  it('applies to recurring income the same way', () => {
    const byLabel = Object.fromEntries(
      months([{ ...hosting, type: 'income', amount: 900 }]).map((b) => [b.label, b.income]),
    )
    expect(byLabel['Aug 2026']).toBe(900)
  })

  it('keeps net consistent with the projected income and expense', () => {
    const [, second] = months([
      { ...hosting, type: 'income', amount: 900 },
      hosting,
    ])
    expect(second.income).toBe(900)
    expect(second.expense).toBe(20)
    expect(second.net).toBe(880)
  })

  it('sums a recurring charge alongside a one-off in the same month', () => {
    const byLabel = expenseByLabel([
      hosting,
      { type: 'expense', amount: 5, occurredAt: '2026-07-04T00:00:00Z' },
    ])
    expect(byLabel['Jul 2026']).toBe(25)
  })
})

// ── expandRecurring ─────────────────────────────────────────────────────────
// The shared definition the chart, the period totals and the transaction feed
// all read, so a charge cannot be counted six times in one and once in another.

const MAR = new Date('2026-03-01T00:00:00Z')
const AUG_END = new Date('2026-08-31T23:59:59Z')

describe('expandRecurring', () => {
  it('emits one occurrence per month for a monthly charge', () => {
    const out = expandRecurring([hosting], MAR, AUG_END)
    expect(out.map((r) => r.occurredAt.slice(0, 7))).toEqual([
      '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
    ])
  })

  it('marks repeats as projected but not the original entry', () => {
    const out = expandRecurring([hosting], MAR, AUG_END)
    // The original is a real database row and stays editable; the repeats are
    // derived and must not offer edit or delete.
    expect(out[0].isProjected).toBe(false)
    expect(out.slice(1).every((r) => r.isProjected)).toBe(true)
  })

  it('emits every third month for a quarterly charge', () => {
    const out = expandRecurring([{ ...hosting, frequency: 'quarterly' }], MAR, AUG_END)
    expect(out.map((r) => r.occurredAt.slice(0, 7))).toEqual(['2026-03', '2026-06'])
  })

  it('emits an annual charge once', () => {
    const out = expandRecurring([{ ...hosting, frequency: 'annual' }], MAR, AUG_END)
    expect(out.map((r) => r.occurredAt.slice(0, 7))).toEqual(['2026-03'])
  })

  it('leaves one-off rows alone and never marks them projected', () => {
    const oneOff = { type: 'expense', amount: 5, occurredAt: '2026-04-09T00:00:00Z' }
    const out = expandRecurring([oneOff], MAR, AUG_END)
    expect(out).toHaveLength(1)
    expect(out[0].isProjected).toBe(false)
    expect(out[0].occurredAt).toBe(oneOff.occurredAt)
  })

  it('drops one-off rows outside the window', () => {
    expect(expandRecurring(
      [{ type: 'expense', amount: 5, occurredAt: '2025-01-09T00:00:00Z' }],
      MAR, AUG_END,
    )).toHaveLength(0)
  })

  it('stops emitting after the recurrence ended', () => {
    const out = expandRecurring([{ ...hosting, recurrenceEndedAt: '2026-05-20' }], MAR, AUG_END)
    expect(out.map((r) => r.occurredAt.slice(0, 7))).toEqual(['2026-03', '2026-04', '2026-05'])
  })

  it('emits nothing before the charge started', () => {
    const out = expandRecurring([{ ...hosting, occurredAt: '2026-07-01T00:00:00Z' }], MAR, AUG_END)
    expect(out.map((r) => r.occurredAt.slice(0, 7))).toEqual(['2026-07', '2026-08'])
  })

  it('carries the row\'s other fields onto every occurrence', () => {
    const out = expandRecurring(
      [{ ...hosting, category: 'Hosting', description: 'DigitalOcean' }],
      MAR, AUG_END,
    )
    expect(out.every((r) => r.category === 'Hosting' && r.amount === 20)).toBe(true)
  })

  it('agrees with what bucketByMonth reports for the same charge', () => {
    // The two must never disagree — that split was the original bug: the chart
    // counted six occurrences while every other figure counted one.
    const expandedTotal = expandRecurring([hosting], MAR, AUG_END)
      .reduce((s, r) => s + r.amount, 0)
    const bucketedTotal = months([hosting]).reduce((s, b) => s + b.expense, 0)
    expect(expandedTotal).toBe(bucketedTotal)
  })
})
