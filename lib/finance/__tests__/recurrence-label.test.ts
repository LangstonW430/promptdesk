import { describe, it, expect } from 'vitest'
import { recurrenceLabel } from '../recurrence-label'

// A standing charge begun 4 June 2026, as the ledger sees it in June (the row
// itself) and in September (a repeat `expandRecurring` computed).
const startingMonth = {
  occurredAt: '2026-06-04T00:00:00.000Z',
  frequency: 'monthly',
  isProjected: false,
  seriesStartAt: '2026-06-04T00:00:00.000Z',
}
const repeat = {
  ...startingMonth,
  occurredAt: '2026-09-04T00:00:00.000Z',
  isProjected: true,
}

describe('recurrenceLabel', () => {
  it('labels a running charge by its cadence alone, whichever month it is', () => {
    expect(recurrenceLabel(startingMonth).label).toBe('Monthly')
    expect(recurrenceLabel(repeat).label).toBe('Monthly')
  })

  it('never puts the projection detail in the badge', () => {
    // The whole point: which month holds the underlying row is bookkeeping, and
    // showing it made one subscription wear two labels down the same column.
    expect(recurrenceLabel(repeat).label).not.toContain('repeat')
  })

  it('keeps the charge that a repeat belongs to in the tooltip', () => {
    const { title } = recurrenceLabel(repeat)
    expect(title).toContain('Jun 4, 2026')
    expect(title).toContain('repeat')
    expect(recurrenceLabel(startingMonth).title).not.toContain('repeat of')
  })

  it.each([
    ['monthly', 'Monthly'],
    ['quarterly', 'Quarterly'],
    ['annual', 'Annual'],
  ])('reads %s as %s', (frequency, expected) => {
    expect(recurrenceLabel({ ...startingMonth, frequency }).label).toBe(expected)
  })

  it('says only that an unknown cadence recurs', () => {
    // Stripe imports arrive with no frequency; claiming "Monthly" stated an
    // annual subscription's billing period wrongly.
    expect(recurrenceLabel({ ...startingMonth, frequency: null }).label).toBe('Recurring')
    expect(recurrenceLabel({ occurredAt: startingMonth.occurredAt }).label).toBe('Recurring')
  })

  it('marks a stopped charge with the date it stopped', () => {
    const ended = recurrenceLabel({ ...startingMonth, recurrenceEndedAt: '2026-08-31' })
    expect(ended.label).toBe('Monthly · ended Aug 31')
    expect(ended.ended).toBe(true)
    expect(ended.title).toContain('stopped on Aug 31, 2026')
  })

  it('carries the stopped label on every occurrence, repeats included', () => {
    const ended = recurrenceLabel({ ...repeat, recurrenceEndedAt: '2026-09-30' })
    expect(ended.label).toBe('Monthly · ended Sep 30')
    expect(ended.title).toContain('Jun 4, 2026')
  })

  it('spells out the year when the charge stopped in a different one', () => {
    // An occurrence from 2025 of a charge stopped in 2026: a bare "ended Jan 31"
    // would read as a date that has not come round yet.
    const ended = recurrenceLabel({
      ...repeat,
      occurredAt: '2025-06-04T00:00:00.000Z',
      recurrenceEndedAt: '2026-01-31',
    })
    expect(ended.label).toBe('Monthly · ended Jan 31, 2026')
  })

  it('reports a running charge as not ended', () => {
    expect(recurrenceLabel(startingMonth).ended).toBe(false)
    expect(recurrenceLabel({ ...startingMonth, recurrenceEndedAt: null }).ended).toBe(false)
  })
})
