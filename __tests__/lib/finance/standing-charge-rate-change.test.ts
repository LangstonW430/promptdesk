import { describe, it, expect, beforeEach, vi } from 'vitest'

const clientCount = vi.fn()
const projectCount = vi.fn()
const transactionCreate = vi.fn()
const transactionUpdate = vi.fn()
const transactionFindFirst = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    client: { get count() { return clientCount } },
    project: { get count() { return projectCount } },
    transaction: {
      get create() { return transactionCreate },
      get update() { return transactionUpdate },
      get findFirst() { return transactionFindFirst },
    },
    // The split has to be one write or none: an old rate stopped without its
    // replacement would silently drop the subscription off the ledger.
    $transaction: (ops: unknown[]) => Promise.all(ops),
  },
}))

const { supersedeStandingCharge } = await import('@/lib/finance')
const { expandRecurring } = await import('@/lib/finance/calc')

const OWNER = 'owner-abc'

/** A subscription entered in May at the lower tier. */
const subscription = {
  id: 'sub-1',
  ownerId: OWNER,
  type: 'expense',
  source: 'manual',
  amount: 49,
  currency: 'usd',
  description: 'Design tool',
  category: 'Software',
  occurredAt: new Date('2026-05-15T00:00:00.000Z'),
  clientId: null,
  projectId: null,
  externalId: null,
  externalType: null,
  isRecurring: true,
  frequency: 'monthly' as string | null,
  recurrenceEndedAt: null as Date | null,
  hiddenAt: null,
  stripeSubscriptionId: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
}

/** The upgrade: same subscription, higher tier, from August. */
const upgrade = {
  effectiveFrom: '2026-08-01',
  type: 'expense' as const,
  amount: 99,
  description: 'Design tool',
  category: 'Software',
  clientId: null,
  projectId: null,
  frequency: 'monthly' as const,
}

/** The row the mocked Prisma is holding, so the writes echo the right one. */
let stored: typeof subscription

/** Point the mocks at a variant of the subscription. */
function useCharge(overrides: Partial<typeof subscription> = {}) {
  stored = { ...subscription, ...overrides }
  transactionFindFirst.mockResolvedValue(stored)
}

beforeEach(() => {
  vi.clearAllMocks()
  useCharge()
  // Echo back what was written, the way Prisma does.
  transactionUpdate.mockImplementation(({ where, data }) => ({
    ...stored, ...data, id: where.id,
  }))
  transactionCreate.mockImplementation(({ data }) => ({
    ...stored, ...data, id: 'sub-2',
  }))
})

describe('supersedeStandingCharge', () => {
  it('stops the old rate the month before the new one starts', async () => {
    const result = await supersedeStandingCharge(OWNER, 'sub-1', upgrade)

    // July, not "the day before the upgrade". recurrenceEndedAt keeps the month
    // it falls in, so ending on 31 July is what leaves August to the new rate.
    expect(transactionUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { recurrenceEndedAt: new Date('2026-07-31T00:00:00.000Z') },
    })
    expect(result?.previous.recurrenceEndedAt).toBe('2026-07-31')
  })

  it('leaves the old rate itself untouched', async () => {
    await supersedeStandingCharge(OWNER, 'sub-1', upgrade)
    const { data } = transactionUpdate.mock.calls[0][0]
    // The whole point: what May, June and July were billed does not move.
    expect(data.amount).toBeUndefined()
    expect(data.occurredAt).toBeUndefined()
  })

  it('starts the new rate as a charge of its own', async () => {
    const result = await supersedeStandingCharge(OWNER, 'sub-1', upgrade)
    const { data } = transactionCreate.mock.calls[0][0]

    expect(data).toMatchObject({
      ownerId: OWNER,
      source: 'manual',
      amount: 99,
      currency: 'usd',
      isRecurring: true,
      frequency: 'monthly',
      occurredAt: new Date('2026-08-01T00:00:00.000Z'),
    })
    expect(result?.next?.amount).toBe(99)
  })

  it('gives each month exactly one rate, the one in force', async () => {
    // The end of the story the user actually sees: no month counts both tiers,
    // no month counts neither, and the months before the upgrade still report
    // what was paid.
    const result = await supersedeStandingCharge(OWNER, 'sub-1', upgrade)
    const rows = expandRecurring(
      [result!.previous, result!.next!],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-08-31T23:59:59.999Z'),
    )

    const byMonth = rows.reduce<Record<string, number[]>>((acc, r) => {
      const key = r.occurredAt.slice(0, 7)
      ;(acc[key] ??= []).push(r.amount)
      return acc
    }, {})

    expect(byMonth).toEqual({
      '2026-05': [49],
      '2026-06': [49],
      '2026-07': [49],
      '2026-08': [99],
    })
  })

  it('never lets both rates land in one month on a quarterly charge', async () => {
    // The month-before rule has to hold for cadences that skip months too: an
    // overlap here would report the two tiers added together.
    useCharge({
      frequency: 'quarterly',
      occurredAt: new Date('2026-01-15T00:00:00.000Z'),
    })
    const result = await supersedeStandingCharge(OWNER, 'sub-1', {
      ...upgrade,
      frequency: 'quarterly',
    })
    const rows = expandRecurring(
      [result!.previous, result!.next!],
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-12-31T23:59:59.999Z'),
    )
    const months = rows.map((r) => r.occurredAt.slice(0, 7))
    expect(new Set(months).size).toBe(months.length)
    expect(months.sort()).toEqual(['2026-01', '2026-04', '2026-07', '2026-08', '2026-11'])
  })

  it('carries an end date already set on the charge over to the new rate', async () => {
    useCharge({ recurrenceEndedAt: new Date('2026-11-30T00:00:00.000Z') })
    await supersedeStandingCharge(OWNER, 'sub-1', upgrade)
    // The rate changed; the plan to cancel in November did not.
    expect(transactionCreate.mock.calls[0][0].data.recurrenceEndedAt).toEqual(
      new Date('2026-11-30T00:00:00.000Z'),
    )
  })

  it('just edits the charge when the change lands in its first month', async () => {
    // Nothing has been billed at the old rate yet, so there is no earlier month
    // to protect and a second row would cover no months at all.
    const result = await supersedeStandingCharge(OWNER, 'sub-1', {
      ...upgrade,
      effectiveFrom: '2026-05-20',
    })
    expect(transactionCreate).not.toHaveBeenCalled()
    expect(result?.next).toBeNull()
    expect(transactionUpdate.mock.calls[0][0].data).toMatchObject({ amount: 99 })
  })

  it('refuses a change dated before the charge began', async () => {
    await expect(
      supersedeStandingCharge(OWNER, 'sub-1', { ...upgrade, effectiveFrom: '2026-03-01' }),
    ).rejects.toThrow(/cannot start before/i)
    expect(transactionCreate).not.toHaveBeenCalled()
  })

  it('refuses a charge that already stopped before the change', async () => {
    useCharge({ recurrenceEndedAt: new Date('2026-06-30T00:00:00.000Z') })
    await expect(supersedeStandingCharge(OWNER, 'sub-1', upgrade)).rejects.toThrow(
      /already stopped/i,
    )
  })

  it('refuses a one-off', async () => {
    useCharge({ isRecurring: false, frequency: null })
    await expect(supersedeStandingCharge(OWNER, 'sub-1', upgrade)).rejects.toThrow(
      /recurring/i,
    )
  })

  it('refuses an imported charge, which Stripe re-bills on its own', async () => {
    useCharge({ source: 'stripe' })
    await expect(supersedeStandingCharge(OWNER, 'sub-1', upgrade)).rejects.toThrow(
      /Stripe/,
    )
    expect(transactionCreate).not.toHaveBeenCalled()
  })

  it('returns null for a transaction that is not the owner’s', async () => {
    transactionFindFirst.mockResolvedValue(null)
    expect(await supersedeStandingCharge(OWNER, 'nope', upgrade)).toBeNull()
  })
})
