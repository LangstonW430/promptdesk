import { describe, it, expect } from 'vitest'
import { toCumulative } from '../calc'
import type { MonthlyStat } from '../types'

function month(label: string, income: number, expense: number): MonthlyStat {
  return { year: 2026, month: 1, label, income, expense, net: income - expense }
}

const SERIES = [
  month('Mar 2026', 100, 40),
  month('Apr 2026', 200, 60),
  month('May 2026', 50, 300),
]

describe('toCumulative', () => {
  it('accumulates income and expense across the window', () => {
    expect(toCumulative(SERIES).map((r) => [r.income, r.expense])).toEqual([
      [100, 40],
      [300, 100],
      [350, 400],
    ])
  })

  it('keeps net as the difference of the two running totals', () => {
    // Which is also the running total of the monthly nets — the reader must get
    // the same answer whichever way they add it up.
    const out = toCumulative(SERIES)
    let runningNet = 0
    SERIES.forEach((r, i) => {
      runningNet += r.net
      expect(out[i].net).toBe(runningNet)
      expect(out[i].net).toBe(out[i].income - out[i].expense)
    })
  })

  it('lets cumulative net go negative when spending overtakes earning', () => {
    expect(toCumulative(SERIES)[2].net).toBe(-50)
  })

  it('starts from the first month in the window, not from zero history', () => {
    // The chart shows a fixed span, so the first point is that month's own
    // figures rather than a total carried in from before it.
    const [first] = toCumulative(SERIES)
    expect(first.income).toBe(100)
    expect(first.expense).toBe(40)
  })

  it('never decreases the income or expense totals', () => {
    const out = toCumulative(SERIES)
    for (let i = 1; i < out.length; i++) {
      expect(out[i].income).toBeGreaterThanOrEqual(out[i - 1].income)
      expect(out[i].expense).toBeGreaterThanOrEqual(out[i - 1].expense)
    }
  })

  it('carries the month labels through unchanged', () => {
    expect(toCumulative(SERIES).map((r) => r.label)).toEqual(
      SERIES.map((r) => r.label),
    )
  })

  it('does not mutate its input', () => {
    const snapshot = JSON.parse(JSON.stringify(SERIES))
    toCumulative(SERIES)
    expect(SERIES).toEqual(snapshot)
  })

  it('handles an empty series', () => {
    expect(toCumulative([])).toEqual([])
  })
})
