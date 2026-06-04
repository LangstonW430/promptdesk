import { describe, it, expect } from 'vitest'
import {
  getPeriodBoundaries,
  sumFinancials,
  bucketByMonth,
  groupByCategory,
  groupByClient,
} from '../calc'

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-06-15T12:00:00Z')  // mid-June 2026

function iso(dateStr: string) { return dateStr }  // readability alias

// ─── getPeriodBoundaries ──────────────────────────────────────────────────────

describe('getPeriodBoundaries', () => {
  it('thisMonth: from = Jun 1, to = Jul 1 (exclusive)', () => {
    const { from, to } = getPeriodBoundaries('thisMonth', NOW)
    expect(from?.toISOString()).toBe('2026-06-01T00:00:00.000Z')
    expect(to?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('thisQuarter: Q2 starts Apr 1, ends Jul 1', () => {
    const { from, to } = getPeriodBoundaries('thisQuarter', NOW)
    expect(from?.toISOString()).toBe('2026-04-01T00:00:00.000Z')
    expect(to?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('thisQuarter: Q1 (January) starts Jan 1, ends Apr 1', () => {
    const jan = new Date('2026-01-20T00:00:00Z')
    const { from, to } = getPeriodBoundaries('thisQuarter', jan)
    expect(from?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(to?.toISOString()).toBe('2026-04-01T00:00:00.000Z')
  })

  it('thisQuarter: Q4 (October) starts Oct 1, ends Jan 1 next year', () => {
    const oct = new Date('2026-10-10T00:00:00Z')
    const { from, to } = getPeriodBoundaries('thisQuarter', oct)
    expect(from?.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(to?.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('ytd: from = Jan 1 this year, to = Jan 1 next year', () => {
    const { from, to } = getPeriodBoundaries('ytd', NOW)
    expect(from?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(to?.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('allTime: both null', () => {
    const { from, to } = getPeriodBoundaries('allTime', NOW)
    expect(from).toBeNull()
    expect(to).toBeNull()
  })
})

// ─── sumFinancials ────────────────────────────────────────────────────────────

describe('sumFinancials', () => {
  it('returns zeros for empty array', () => {
    expect(sumFinancials([])).toEqual({ totalIncome: 0, totalExpense: 0, net: 0 })
  })

  it('sums income only', () => {
    const rows = [
      { type: 'income', amount: 1000 },
      { type: 'income', amount: 500 },
    ]
    expect(sumFinancials(rows)).toEqual({ totalIncome: 1500, totalExpense: 0, net: 1500 })
  })

  it('sums expenses only', () => {
    const rows = [
      { type: 'expense', amount: 200 },
      { type: 'expense', amount: 300 },
    ]
    expect(sumFinancials(rows)).toEqual({ totalIncome: 0, totalExpense: 500, net: -500 })
  })

  it('computes net correctly for mixed rows', () => {
    const rows = [
      { type: 'income', amount: 3000 },
      { type: 'expense', amount: 800 },
      { type: 'income', amount: 200 },
      { type: 'expense', amount: 100 },
    ]
    const result = sumFinancials(rows)
    expect(result.totalIncome).toBe(3200)
    expect(result.totalExpense).toBe(900)
    expect(result.net).toBe(2300)
  })
})

// ─── bucketByMonth ─────────────────────────────────────────────────────────────

describe('bucketByMonth', () => {
  it('returns exactly `months` buckets', () => {
    expect(bucketByMonth([], 6, NOW)).toHaveLength(6)
    expect(bucketByMonth([], 1, NOW)).toHaveLength(1)
  })

  it('last bucket is the current month', () => {
    const buckets = bucketByMonth([], 3, NOW)
    const last = buckets[buckets.length - 1]
    expect(last.year).toBe(2026)
    expect(last.month).toBe(6)
    expect(last.label).toBe('Jun 2026')
  })

  it('first bucket is `months - 1` months back', () => {
    const buckets = bucketByMonth([], 3, NOW)
    expect(buckets[0].year).toBe(2026)
    expect(buckets[0].month).toBe(4)  // Apr
  })

  it('wraps correctly across year boundary', () => {
    const jan = new Date('2026-01-15T00:00:00Z')
    const buckets = bucketByMonth([], 3, jan)
    expect(buckets[0]).toMatchObject({ year: 2025, month: 11, label: 'Nov 2025' })
    expect(buckets[1]).toMatchObject({ year: 2025, month: 12, label: 'Dec 2025' })
    expect(buckets[2]).toMatchObject({ year: 2026, month: 1,  label: 'Jan 2026' })
  })

  it('places transactions into the correct month bucket', () => {
    const rows = [
      { type: 'income',  amount: 1000, occurredAt: iso('2026-06-01') },
      { type: 'expense', amount: 200,  occurredAt: iso('2026-06-30') },
      { type: 'income',  amount: 500,  occurredAt: iso('2026-05-15') },
    ]
    const buckets = bucketByMonth(rows, 3, NOW)
    const jun = buckets.find((b) => b.month === 6)!
    const may = buckets.find((b) => b.month === 5)!
    expect(jun.income).toBe(1000)
    expect(jun.expense).toBe(200)
    expect(jun.net).toBe(800)
    expect(may.income).toBe(500)
    expect(may.expense).toBe(0)
  })

  it('ignores transactions outside the window', () => {
    const rows = [
      { type: 'income', amount: 9999, occurredAt: iso('2025-01-01') },  // too old
    ]
    const buckets = bucketByMonth(rows, 3, NOW)
    expect(buckets.every((b) => b.income === 0)).toBe(true)
  })

  it('all buckets start with zero values when no transactions', () => {
    const buckets = bucketByMonth([], 6, NOW)
    expect(buckets.every((b) => b.income === 0 && b.expense === 0 && b.net === 0)).toBe(true)
  })
})

// ─── groupByCategory ──────────────────────────────────────────────────────────

describe('groupByCategory', () => {
  it('returns empty array for no rows', () => {
    expect(groupByCategory([])).toEqual([])
  })

  it('sums amounts by category', () => {
    const rows = [
      { type: 'expense', amount: 50,  category: 'Software' },
      { type: 'expense', amount: 100, category: 'Software' },
      { type: 'expense', amount: 30,  category: 'Travel' },
    ]
    const result = groupByCategory(rows)
    const sw = result.find((r) => r.category === 'Software')!
    const tr = result.find((r) => r.category === 'Travel')!
    expect(sw.total).toBe(150)
    expect(sw.count).toBe(2)
    expect(tr.total).toBe(30)
    expect(tr.count).toBe(1)
  })

  it('sorts by total descending', () => {
    const rows = [
      { type: 'expense', amount: 10,  category: 'A' },
      { type: 'expense', amount: 100, category: 'B' },
      { type: 'expense', amount: 50,  category: 'C' },
    ]
    const result = groupByCategory(rows)
    expect(result.map((r) => r.category)).toEqual(['B', 'C', 'A'])
  })

  it('handles income categories the same way', () => {
    const rows = [
      { type: 'income', amount: 2000, category: 'Client work' },
      { type: 'income', amount: 500,  category: 'Retainer' },
      { type: 'income', amount: 1000, category: 'Client work' },
    ]
    const result = groupByCategory(rows)
    const cw = result.find((r) => r.category === 'Client work')!
    expect(cw.total).toBe(3000)
    expect(cw.count).toBe(2)
  })
})

// ─── groupByClient ─────────────────────────────────────────────────────────────

describe('groupByClient', () => {
  it('returns empty array for no rows', () => {
    expect(groupByClient([])).toEqual([])
  })

  it('only aggregates income rows', () => {
    const rows = [
      { type: 'income',  amount: 1000, clientId: 'c1', clientName: 'Acme' },
      { type: 'expense', amount: 200,  clientId: 'c1', clientName: 'Acme' },
    ]
    const result = groupByClient(rows)
    expect(result).toHaveLength(1)
    expect(result[0].total).toBe(1000)
  })

  it('groups multiple income rows for same client', () => {
    const rows = [
      { type: 'income', amount: 1000, clientId: 'c1', clientName: 'Acme' },
      { type: 'income', amount: 500,  clientId: 'c1', clientName: 'Acme' },
      { type: 'income', amount: 200,  clientId: 'c2', clientName: 'Bright' },
    ]
    const result = groupByClient(rows)
    const acme = result.find((r) => r.clientId === 'c1')!
    expect(acme.total).toBe(1500)
    expect(result.find((r) => r.clientId === 'c2')?.total).toBe(200)
  })

  it('handles null clientId (unlinked income)', () => {
    const rows = [
      { type: 'income', amount: 300, clientId: null, clientName: null },
    ]
    const result = groupByClient(rows)
    expect(result[0].clientId).toBeNull()
    expect(result[0].total).toBe(300)
  })

  it('sorts by total descending', () => {
    const rows = [
      { type: 'income', amount: 100, clientId: 'c1', clientName: 'A' },
      { type: 'income', amount: 500, clientId: 'c2', clientName: 'B' },
      { type: 'income', amount: 200, clientId: 'c3', clientName: 'C' },
    ]
    const result = groupByClient(rows)
    expect(result.map((r) => r.clientId)).toEqual(['c2', 'c3', 'c1'])
  })
})
