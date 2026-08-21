import { describe, it, expect } from 'vitest'
import { expandRecurring } from '../calc'

/**
 * A subscription entered once keeps applying to every later month, but only
 * the month it began in contains the row itself. In every period after that,
 * the rows on screen are all projections — so if a projection cannot be traced
 * back to the row it came from, there is nothing on the Finance page to edit
 * or stop, and a cancelled or upgraded subscription counts toward MRR forever.
 *
 * `seriesStartAt` is that trace: the date the underlying row carries, kept on
 * every occurrence.
 */

const monthly = {
  occurredAt: '2026-05-15T00:00:00.000Z',
  type: 'expense',
  amount: 49,
  isRecurring: true,
  frequency: 'monthly',
}

// Viewing "this month" — August — three months after the charge began.
const AUGUST_FROM = new Date('2026-08-01T00:00:00.000Z')
const AUGUST_TO = new Date('2026-08-31T23:59:59.999Z')

describe('expandRecurring — reaching the row behind a repeat', () => {
  it('leaves only projections in a period after the charge began', () => {
    const rows = expandRecurring([monthly], AUGUST_FROM, AUGUST_TO)
    expect(rows).toHaveLength(1)
    expect(rows[0].isProjected).toBe(true)
  })

  it('carries the real start date on a projection', () => {
    const [row] = expandRecurring([monthly], AUGUST_FROM, AUGUST_TO)
    // What the row shows is August; what the database holds is May, and that
    // is the date an edit has to write back.
    expect(row.occurredAt.slice(0, 10)).toBe('2026-08-15')
    expect(row.seriesStartAt).toBe(monthly.occurredAt)
  })

  it('carries it on every occurrence, including the original month', () => {
    const rows = expandRecurring(
      [monthly],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-08-31T23:59:59.999Z'),
    )
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.seriesStartAt === monthly.occurredAt)).toBe(true)
    // May is the row itself; June onward are repeats of it.
    expect(rows.map((r) => r.isProjected)).toEqual([false, true, true, true])
  })

  it('gives a one-off its own date', () => {
    const oneOff = { occurredAt: '2026-08-04T00:00:00.000Z', type: 'expense', amount: 12 }
    const [row] = expandRecurring([oneOff], AUGUST_FROM, AUGUST_TO)
    expect(row.seriesStartAt).toBe(oneOff.occurredAt)
    expect(row.isProjected).toBe(false)
  })

  it('stops projecting once the charge is marked as ended', () => {
    // The upgrade case: the old tier ran until July, the new one starts then.
    // August must show nothing for the old charge, while the months it did
    // apply to keep counting it.
    const ended = { ...monthly, recurrenceEndedAt: '2026-07-15' }
    expect(expandRecurring([ended], AUGUST_FROM, AUGUST_TO)).toHaveLength(0)
    expect(
      expandRecurring(
        [ended],
        new Date('2026-05-01T00:00:00.000Z'),
        new Date('2026-08-31T23:59:59.999Z'),
      ),
    ).toHaveLength(3)
  })
})
