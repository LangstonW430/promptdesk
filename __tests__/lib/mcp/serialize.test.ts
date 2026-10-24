import { describe, it, expect } from 'vitest'
import { toDateOnly, toDecimalString, toIso } from '@/lib/mcp/serialize'

describe('toDecimalString', () => {
  /**
   * The whole reason this returns a string. A `Decimal(12,2)` holding 1234.50
   * becomes "1234.5" the moment it passes through a JS number, and nothing
   * downstream can tell that it did.
   */
  it('keeps trailing zeros a number would drop', () => {
    const decimal = { toString: () => '1234.50' }
    expect(toDecimalString(decimal)).toBe('1234.50')
  })

  it('passes through null and undefined', () => {
    expect(toDecimalString(null)).toBeNull()
    expect(toDecimalString(undefined)).toBeNull()
  })

  it('accepts a plain number for callers that already summed one', () => {
    expect(toDecimalString(0)).toBe('0')
    expect(toDecimalString(-12.5)).toBe('-12.5')
  })
})

describe('toIso', () => {
  it('renders a full timestamp', () => {
    expect(toIso(new Date('2026-06-03T12:34:56.000Z'))).toBe(
      '2026-06-03T12:34:56.000Z',
    )
  })

  it('passes through null', () => {
    expect(toIso(null)).toBeNull()
    expect(toIso(undefined)).toBeNull()
  })
})

describe('toDateOnly', () => {
  /**
   * `dueDate` and the contact dates are `@db.Date` — a calendar day. Emitting
   * the full ISO form would append a midnight-UTC time and invite a reader to
   * shift it into a local zone and land on the day before.
   */
  it('renders a calendar day with no time or zone', () => {
    expect(toDateOnly(new Date('2026-06-03T00:00:00.000Z'))).toBe('2026-06-03')
  })

  it('passes through null', () => {
    expect(toDateOnly(null)).toBeNull()
    expect(toDateOnly(undefined)).toBeNull()
  })
})
