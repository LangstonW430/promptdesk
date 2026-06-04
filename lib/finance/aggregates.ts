import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db/client'
import {
  getPeriodBoundaries,
  sumFinancials,
  bucketByMonth,
  groupByCategory,
  groupByClient,
} from './calc'
import type { Period, FinancialSummary, MonthlyStat, CategoryStat, ClientIncomeStat } from './types'

function dateFilter(from: Date | null, to: Date | null) {
  if (!from && !to) return {}
  return {
    occurredAt: {
      ...(from && { gte: from }),
      ...(to && { lt: to }),
    },
  }
}

// ─── Financial summary ────────────────────────────────────────────────────────

export const getFinancialSummary = unstable_cache(
  async (ownerId: string, period: Period): Promise<FinancialSummary> => {
    const { from, to } = getPeriodBoundaries(period)
    const rows = await prisma.transaction.findMany({
      where: { ownerId, ...dateFilter(from, to) },
      select: { type: true, amount: true },
    })
    return sumFinancials(rows.map((r) => ({ type: r.type, amount: Number(r.amount) })))
  },
  ['finance-summary'],
  { revalidate: 60 },
)

// ─── Monthly series ───────────────────────────────────────────────────────────

export const getMonthlySeries = unstable_cache(
  async (ownerId: string, months: number): Promise<MonthlyStat[]> => {
    // Fetch enough history to fill all buckets
    const windowStart = new Date()
    windowStart.setUTCMonth(windowStart.getUTCMonth() - (months - 1))
    windowStart.setUTCDate(1)
    windowStart.setUTCHours(0, 0, 0, 0)

    const rows = await prisma.transaction.findMany({
      where: { ownerId, occurredAt: { gte: windowStart } },
      select: { type: true, amount: true, occurredAt: true },
    })

    return bucketByMonth(
      rows.map((r) => ({
        type: r.type,
        amount: Number(r.amount),
        occurredAt: r.occurredAt.toISOString(),
      })),
      months,
    )
  },
  ['finance-monthly'],
  { revalidate: 60 },
)

// ─── Expenses by category ─────────────────────────────────────────────────────

export const getExpensesByCategory = unstable_cache(
  async (ownerId: string, period: Period): Promise<CategoryStat[]> => {
    const { from, to } = getPeriodBoundaries(period)
    const rows = await prisma.transaction.findMany({
      where: { ownerId, type: 'expense', ...dateFilter(from, to) },
      select: { type: true, amount: true, category: true },
    })
    return groupByCategory(
      rows.map((r) => ({ type: r.type, amount: Number(r.amount), category: r.category })),
    )
  },
  ['finance-expenses-category'],
  { revalidate: 60 },
)

// ─── Income by client ─────────────────────────────────────────────────────────

export const getIncomeByClient = unstable_cache(
  async (ownerId: string, period: Period): Promise<ClientIncomeStat[]> => {
    const { from, to } = getPeriodBoundaries(period)
    const rows = await prisma.transaction.findMany({
      where: { ownerId, type: 'income', ...dateFilter(from, to) },
      select: {
        type: true,
        amount: true,
        clientId: true,
        client: { select: { companyName: true, contactName: true } },
      },
    })
    return groupByClient(
      rows.map((r) => ({
        type: r.type,
        amount: Number(r.amount),
        clientId: r.clientId,
        clientName: r.client
          ? (r.client.companyName ?? r.client.contactName ?? 'Unknown')
          : null,
      })),
    )
  },
  ['finance-income-client'],
  { revalidate: 60 },
)
