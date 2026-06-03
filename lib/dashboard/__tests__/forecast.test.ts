import { describe, it, expect } from 'vitest'
import { computeRevenueForecast, computeConversionRate } from '../forecast'
import { DEFAULT_STAGE_PROBABILITIES } from '../types'

// ─── computeRevenueForecast ───────────────────────────────────────────────────

describe('computeRevenueForecast', () => {
  it('returns 0 for an empty group array', () => {
    expect(computeRevenueForecast([], DEFAULT_STAGE_PROBABILITIES)).toBe(0)
  })

  it('computes the weighted sum with default probabilities', () => {
    // lead(10%): 1000 → 100
    // contacted(25%): 2000 → 500
    // total = 600
    const groups = [
      { status: 'lead', count: 1, sumValue: 1000 },
      { status: 'contacted', count: 1, sumValue: 2000 },
    ]
    expect(computeRevenueForecast(groups, DEFAULT_STAGE_PROBABILITIES)).toBeCloseTo(600)
  })

  it('computes across all four open stages', () => {
    // lead(10%)*1000=100, contacted(25%)*2000=500, proposal_sent(50%)*4000=2000, negotiating(70%)*10000=7000
    // total = 9600
    const groups = [
      { status: 'lead', count: 1, sumValue: 1000 },
      { status: 'contacted', count: 2, sumValue: 2000 },
      { status: 'proposal_sent', count: 1, sumValue: 4000 },
      { status: 'negotiating', count: 1, sumValue: 10_000 },
    ]
    expect(computeRevenueForecast(groups, DEFAULT_STAGE_PROBABILITIES)).toBeCloseTo(9600)
  })

  it('uses user-overridden probabilities when provided', () => {
    const overridden = { ...DEFAULT_STAGE_PROBABILITIES, lead: 20 }
    const groups = [{ status: 'lead', count: 1, sumValue: 1000 }]
    expect(computeRevenueForecast(groups, overridden)).toBeCloseTo(200)
  })

  it('skips won and lost groups — they have no probability entry', () => {
    const groups = [
      { status: 'won', count: 3, sumValue: 30_000 },
      { status: 'lost', count: 2, sumValue: 20_000 },
    ]
    expect(computeRevenueForecast(groups, DEFAULT_STAGE_PROBABILITIES)).toBe(0)
  })

  it('treats a sumValue of 0 as 0 contribution', () => {
    const groups = [{ status: 'negotiating', count: 1, sumValue: 0 }]
    expect(computeRevenueForecast(groups, DEFAULT_STAGE_PROBABILITIES)).toBe(0)
  })

  it('handles a mix of open and closed stages correctly', () => {
    // negotiating(70%)*5000=3500, won skipped
    const groups = [
      { status: 'negotiating', count: 1, sumValue: 5000 },
      { status: 'won', count: 1, sumValue: 10_000 },
    ]
    expect(computeRevenueForecast(groups, DEFAULT_STAGE_PROBABILITIES)).toBeCloseTo(3500)
  })

  it('probability of 100 passes the full value through', () => {
    const certainProbs = { ...DEFAULT_STAGE_PROBABILITIES, proposal_sent: 100 }
    const groups = [{ status: 'proposal_sent', count: 1, sumValue: 7500 }]
    expect(computeRevenueForecast(groups, certainProbs)).toBeCloseTo(7500)
  })

  it('probability of 0 contributes nothing', () => {
    const zeroProbs = { ...DEFAULT_STAGE_PROBABILITIES, lead: 0 }
    const groups = [{ status: 'lead', count: 5, sumValue: 50_000 }]
    expect(computeRevenueForecast(groups, zeroProbs)).toBe(0)
  })
})

// ─── computeConversionRate ────────────────────────────────────────────────────

describe('computeConversionRate', () => {
  it('returns null when no closed deals exist', () => {
    expect(computeConversionRate(0, 0)).toBeNull()
  })

  it('returns 1 when every closed deal was won', () => {
    expect(computeConversionRate(5, 0)).toBe(1)
  })

  it('returns 0 when every closed deal was lost', () => {
    expect(computeConversionRate(0, 4)).toBe(0)
  })

  it('returns the correct fraction for a mixed set', () => {
    // 3 won, 1 lost → 3/4 = 0.75
    expect(computeConversionRate(3, 1)).toBeCloseTo(0.75)
  })

  it('result is always in [0, 1]', () => {
    const rate = computeConversionRate(7, 3)
    expect(rate).not.toBeNull()
    expect(rate!).toBeGreaterThanOrEqual(0)
    expect(rate!).toBeLessThanOrEqual(1)
  })
})
