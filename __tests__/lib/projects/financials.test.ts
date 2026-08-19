import { describe, it, expect, beforeEach, vi } from 'vitest'

const transactionGroupBy = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    transaction: {
      get groupBy() {
        return transactionGroupBy
      },
    },
  },
}))

const { projectFinancials } = await import('@/lib/projects/financials')

const OWNER = 'owner-abc-123'
const PROJECT = 'project-xyz'

const rows = (income?: number, expense?: number) => {
  const out: Array<{ type: string; _sum: { amount: number | null } }> = []
  if (income !== undefined) out.push({ type: 'income', _sum: { amount: income } })
  if (expense !== undefined) out.push({ type: 'expense', _sum: { amount: expense } })
  return out
}

describe('projectFinancials', () => {
  beforeEach(() => {
    transactionGroupBy.mockReset()
    transactionGroupBy.mockResolvedValue([])
  })

  it('scopes the aggregate to the owner and the project', async () => {
    await projectFinancials(OWNER, PROJECT, null)

    const where = transactionGroupBy.mock.calls[0][0].where
    expect(where).toMatchObject({ ownerId: OWNER, projectId: PROJECT })
  })

  // A row the user took off their ledger is off it everywhere. Leaving it in
  // here would have a project report income against its budget that the Finance
  // page had already stopped counting.
  it('leaves out rows the user has hidden', async () => {
    await projectFinancials(OWNER, PROJECT, null)

    const where = transactionGroupBy.mock.calls[0][0].where
    expect(where.hiddenAt).toBeNull()
  })

  it('sums income and expenses separately', async () => {
    transactionGroupBy.mockResolvedValue(rows(9_000, 1_500))

    const f = await projectFinancials(OWNER, PROJECT, 10_000)
    expect(f.income).toBe(9_000)
    expect(f.expenses).toBe(1_500)
    expect(f.net).toBe(7_500)
  })

  it('reports a negative net when a project cost more than it earned', async () => {
    transactionGroupBy.mockResolvedValue(rows(1_000, 4_000))

    const f = await projectFinancials(OWNER, PROJECT, 5_000)
    expect(f.net).toBe(-3_000)
    expect(f.margin).toBe(-3)
  })

  it('leaves margin null when no money has come in', async () => {
    // Dividing by zero income would report Infinity, and a project that has
    // only cost money does not have a margin yet — it has a hole.
    transactionGroupBy.mockResolvedValue(rows(undefined, 800))

    const f = await projectFinancials(OWNER, PROJECT, 5_000)
    expect(f.income).toBe(0)
    expect(f.expenses).toBe(800)
    expect(f.margin).toBeNull()
  })

  it('measures collection against the budget, not against income', async () => {
    transactionGroupBy.mockResolvedValue(rows(2_500))

    const f = await projectFinancials(OWNER, PROJECT, 10_000)
    expect(f.budgetCollected).toBe(0.25)
  })

  it('reports collection above 1 when a project was billed past its budget', async () => {
    // Not clamped: the number is the truth, and the UI decides how to draw it.
    transactionGroupBy.mockResolvedValue(rows(12_000))

    const f = await projectFinancials(OWNER, PROJECT, 10_000)
    expect(f.budgetCollected).toBe(1.2)
  })

  it('leaves budgetCollected null when the project carries no budget', async () => {
    transactionGroupBy.mockResolvedValue(rows(3_000))

    const f = await projectFinancials(OWNER, PROJECT, null)
    expect(f.budgetCollected).toBeNull()
  })

  it('leaves budgetCollected null on a zero budget rather than dividing by it', async () => {
    transactionGroupBy.mockResolvedValue(rows(3_000))

    const f = await projectFinancials(OWNER, PROJECT, 0)
    expect(f.budgetCollected).toBeNull()
  })

  it('flags a project with nothing attributed to it', async () => {
    const f = await projectFinancials(OWNER, PROJECT, 10_000)

    expect(f.hasAttributedMoney).toBe(false)
    expect(f.income).toBe(0)
    expect(f.net).toBe(0)
    // Zero collected is a real claim here — the budget exists, nothing landed.
    expect(f.budgetCollected).toBe(0)
  })

  it('flags a project once any money is attributed', async () => {
    transactionGroupBy.mockResolvedValue(rows(undefined, 50))

    const f = await projectFinancials(OWNER, PROJECT, null)
    expect(f.hasAttributedMoney).toBe(true)
  })

  it('treats a null sum as zero', async () => {
    transactionGroupBy.mockResolvedValue([{ type: 'income', _sum: { amount: null } }])

    const f = await projectFinancials(OWNER, PROJECT, 1_000)
    expect(f.income).toBe(0)
  })
})
