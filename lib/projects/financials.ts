import { prisma } from '@/lib/db/client'

/**
 * What a project actually earned and cost, against what it was quoted at.
 *
 * Only possible now that money can be attributed to a project
 * (`transactions.project_id`). Before that, income was filed against a client
 * and nothing could say which piece of their work paid for itself.
 */
export interface ProjectFinancials {
  /** What the project was quoted at. Null when it never carried a budget. */
  budget: number | null
  /** Money received and attributed to this project. */
  income: number
  /** Money spent and attributed to this project. */
  expenses: number
  /** income − expenses. Negative means the project is underwater. */
  net: number
  /**
   * net ÷ income, or null when nothing has come in yet. Deliberately not
   * computed against budget: a budget is a quote, not revenue, and dividing by
   * it would report a margin on money nobody has paid.
   */
  margin: number | null
  /**
   * How much of the budget has been collected, or null when there is no budget
   * to measure against. Can exceed 1 on work that overran and was re-billed.
   */
  budgetCollected: number | null
  /** True when at least one transaction is attributed here. */
  hasAttributedMoney: boolean
}

/**
 * Sums the transactions attributed to one project.
 *
 * Recurring transactions are counted once, at face value, rather than expanded
 * across the periods they apply to. A standing charge attributed to a project
 * is a term of that engagement (a monthly retainer, a subscription bought for
 * it), and the project's lifetime total is what this reports — expanding them
 * would need a window, and a project's P&L has no window but its own life.
 */
export async function projectFinancials(
  ownerId: string,
  projectId: string,
  budget: number | null,
): Promise<ProjectFinancials> {
  const rows = await prisma.transaction.groupBy({
    by: ['type'],
    where: { ownerId, projectId },
    _sum: { amount: true },
  })

  let income = 0
  let expenses = 0
  for (const r of rows) {
    const total = Number(r._sum.amount ?? 0)
    if (r.type === 'income') income += total
    else if (r.type === 'expense') expenses += total
  }

  const net = income - expenses

  return {
    budget,
    income,
    expenses,
    net,
    margin: income > 0 ? net / income : null,
    budgetCollected: budget != null && budget > 0 ? income / budget : null,
    hasAttributedMoney: rows.length > 0,
  }
}
