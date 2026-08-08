import { describe, it, expect } from 'vitest'
import { occurrenceDates, expandRecurring } from '../calc'

/**
 * A one-off transaction dated in the future is still a row the user entered.
 * It used to disappear from the finance list entirely, because the horizon
 * that stops standing charges being projected forward was applied to the whole
 * window rather than only to the projections.
 */

interface Row {
  occurredAt: string
  type: string
  amount: number
  isRecurring?: boolean
  frequency?: string | null
}

const oneOff = (occurredAt: string): Row => ({ occurredAt, type: 'expense', amount: 100 })

const monthly = (occurredAt: string): Row => ({
  occurredAt,
  type: 'expense',
  amount: 20,
  isRecurring: true,
  frequency: 'monthly',
})

// "Today" is 8 Aug; the projection horizon is the end of August.
const FROM = new Date('2026-01-01T00:00:00.000Z')
const TO = new Date('2026-12-31T23:59:59.999Z')
const HORIZON = new Date('2026-08-31T23:59:59.999Z')

describe('occurrenceDates — projection horizon', () => {
  it('keeps a one-off dated after the horizon but inside the window', () => {
    const dates = occurrenceDates(oneOff('2026-11-15T00:00:00.000Z'), FROM, TO, HORIZON)
    expect(dates).toHaveLength(1)
    expect(dates[0].toISOString()).toBe('2026-11-15T00:00:00.000Z')
  })

  it('still drops a one-off outside the window', () => {
    const dates = occurrenceDates(oneOff('2027-02-01T00:00:00.000Z'), FROM, TO, HORIZON)
    expect(dates).toHaveLength(0)
  })

  it('stops projecting a standing charge at the horizon', () => {
    // Jan through August is eight occurrences; September onward has not
    // happened, and showing it would report money nobody has spent.
    const dates = occurrenceDates(monthly('2026-01-10T00:00:00.000Z'), FROM, TO, HORIZON)
    expect(dates).toHaveLength(8)
    expect(dates[dates.length - 1].toISOString()).toBe('2026-08-10T00:00:00.000Z')
  })

  it('defaults the horizon to the window end when none is given', () => {
    const withDefault = occurrenceDates(monthly('2026-01-10T00:00:00.000Z'), FROM, TO)
    expect(withDefault).toHaveLength(12)
  })

  it('never projects past the window even when the horizon is later', () => {
    const narrow = new Date('2026-03-31T23:59:59.999Z')
    const dates = occurrenceDates(monthly('2026-01-10T00:00:00.000Z'), FROM, narrow, HORIZON)
    expect(dates).toHaveLength(3)
  })
})

describe('expandRecurring — projection horizon', () => {
  it('returns the future one-off alongside the projected charges', () => {
    const rows = [monthly('2026-01-10T00:00:00.000Z'), oneOff('2026-11-15T00:00:00.000Z')]
    const out = expandRecurring(rows, FROM, TO, HORIZON)

    const future = out.filter((r) => r.occurredAt.startsWith('2026-11'))
    expect(future).toHaveLength(1)
    // It is a real row, not a derived repeat — it must stay editable.
    expect(future[0].isProjected).toBe(false)

    expect(out.filter((r) => r.isRecurring)).toHaveLength(8)
  })
})
