import { describe, it, expect } from 'vitest'
import { buildBuckets, bucketSeries } from '../series'

// Mid-August, so "this month" has 15 days of history and the year has 8 months.
const NOW = new Date('2026-08-15T12:00:00Z')

describe('buildBuckets — following the period selector', () => {
  it('plots this month by day, up to today', () => {
    // A single monthly bucket is one point, and a line needs at least two.
    const { granularity, buckets } = buildBuckets('thisMonth', NOW)
    expect(granularity).toBe('day')
    expect(buckets).toHaveLength(15)
    expect(buckets[0].label).toBe('1 Aug')
    expect(buckets[14].label).toBe('15 Aug')
  })

  it('never runs past today, so no bucket reads as a collapse to zero', () => {
    const { buckets } = buildBuckets('thisMonth', NOW)
    const last = buckets[buckets.length - 1]
    expect(last.end.getTime()).toBeLessThanOrEqual(
      new Date('2026-08-16T00:00:00Z').getTime(),
    )
  })

  it('plots this quarter by month, from the quarter start to now', () => {
    const { granularity, buckets } = buildBuckets('thisQuarter', NOW)
    expect(granularity).toBe('month')
    // Q3 is Jul–Sep; September has not happened.
    expect(buckets.map((b) => b.label)).toEqual(['Jul 2026', 'Aug 2026'])
  })

  it('plots year to date by month, from January', () => {
    const { granularity, buckets } = buildBuckets('ytd', NOW)
    expect(granularity).toBe('month')
    expect(buckets).toHaveLength(8)
    expect(buckets[0].label).toBe('Jan 2026')
    expect(buckets[7].label).toBe('Aug 2026')
  })

  it('plots all time by month while the history is short', () => {
    const { granularity, buckets } = buildBuckets(
      'allTime', NOW, new Date('2026-05-04T00:00:00Z'),
    )
    expect(granularity).toBe('month')
    expect(buckets.map((b) => b.label)).toEqual([
      'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026',
    ])
  })

  it('switches all time to quarters once the history outgrows a month view', () => {
    // Truncating instead would silently restart a cumulative total partway
    // through, which is worse than a coarser bucket.
    const { granularity, buckets } = buildBuckets(
      'allTime', NOW, new Date('2022-02-01T00:00:00Z'),
    )
    expect(granularity).toBe('quarter')
    expect(buckets[0].label).toBe('Q1 2022')
    expect(buckets[buckets.length - 1].label).toBe('Q3 2026')
  })

  it('falls back to the current month when there is no history at all', () => {
    const { buckets } = buildBuckets('allTime', NOW, null)
    expect(buckets.map((b) => b.label)).toEqual(['Aug 2026'])
  })

  it('produces contiguous, ascending buckets', () => {
    for (const period of ['thisMonth', 'thisQuarter', 'ytd'] as const) {
      const { buckets } = buildBuckets(period, NOW)
      for (let i = 1; i < buckets.length; i++) {
        expect(buckets[i].start.getTime()).toBe(buckets[i - 1].end.getTime())
      }
    }
  })
})

describe('bucketSeries', () => {
  const buckets = buildBuckets('ytd', NOW).buckets

  it('sums one-off rows into the bucket containing their date', () => {
    const points = bucketSeries(
      [
        { type: 'income',  amount: 500, occurredAt: '2026-03-09T00:00:00Z' },
        { type: 'expense', amount: 120, occurredAt: '2026-03-28T00:00:00Z' },
      ],
      buckets,
    )
    const mar = points.find((p) => p.label === 'Mar 2026')!
    expect(mar.income).toBe(500)
    expect(mar.expense).toBe(120)
    expect(mar.net).toBe(380)
  })

  it('repeats a standing charge into every bucket it applies to', () => {
    const points = bucketSeries(
      [{
        type: 'expense', amount: 20, occurredAt: '2026-03-01T00:00:00Z',
        isRecurring: true, frequency: 'monthly',
      }],
      buckets,
    )
    expect(points.map((p) => p.expense)).toEqual([0, 0, 20, 20, 20, 20, 20, 20])
  })

  it('places a daily-bucketed charge on its own day of the month', () => {
    // Occurrences keep the day they started on, which only matters once
    // something buckets finer than a month.
    const days = buildBuckets('thisMonth', NOW).buckets
    const points = bucketSeries(
      [{
        type: 'expense', amount: 20, occurredAt: '2026-03-06T00:00:00Z',
        isRecurring: true, frequency: 'monthly',
      }],
      days,
    )
    expect(points.find((p) => p.label === '6 Aug')!.expense).toBe(20)
    expect(points.find((p) => p.label === '1 Aug')!.expense).toBe(0)
  })

  it('ignores rows outside the bucket range', () => {
    const points = bucketSeries(
      [{ type: 'income', amount: 999, occurredAt: '2024-01-01T00:00:00Z' }],
      buckets,
    )
    expect(points.every((p) => p.income === 0)).toBe(true)
  })

  it('returns a zeroed point per bucket when there is nothing to plot', () => {
    const points = bucketSeries([], buckets)
    expect(points).toHaveLength(buckets.length)
    expect(points.every((p) => p.income === 0 && p.expense === 0 && p.net === 0)).toBe(true)
  })

  it('handles an empty bucket list', () => {
    expect(bucketSeries([], [])).toEqual([])
  })
})
