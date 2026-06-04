import { redirect } from 'next/navigation'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { listTransactions, fetchClientsForPicker } from '@/lib/finance'
import {
  getFinancialSummary,
  getMonthlySeries,
  getExpensesByCategory,
} from '@/lib/finance/aggregates'
import { getSyncState } from '@/lib/finance/stripe-sync'
import { formatCurrency } from '@/lib/dashboard/format'
import { StatCard } from '@/components/dashboard/stat-card'
import { PeriodSelector } from '@/components/finance/period-selector'
import { MonthlyChart } from '@/components/finance/monthly-chart'
import { CategoryChart } from '@/components/finance/category-chart'
import { TransactionsTable } from '@/components/finance/transactions-table'
import { SyncStripeButton } from '@/components/finance/sync-stripe-button'
import type { Period } from '@/lib/finance/types'

const VALID_PERIODS: Period[] = ['thisMonth', 'thisQuarter', 'ytd', 'allTime']

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { period: rawPeriod } = await searchParams
  const period: Period =
    rawPeriod && VALID_PERIODS.includes(rawPeriod as Period)
      ? (rawPeriod as Period)
      : 'thisMonth'

  const [summary, monthlySeries, expensesByCategory, transactions, clients, syncState] =
    await Promise.all([
      getFinancialSummary(ownerId, period),
      getMonthlySeries(ownerId, 6),
      getExpensesByCategory(ownerId, period),
      listTransactions(ownerId, { period }),
      fetchClientsForPicker(ownerId),
      getSyncState(ownerId),
    ])

  const netIsPositive = summary.net >= 0

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Income, expenses, and cash flow
          </p>
        </div>
        <PeriodSelector value={period} />
      </div>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Income"
          value={formatCurrency(summary.totalIncome)}
          subtext="total received"
        />
        <StatCard
          icon={TrendingDown}
          label="Expenses"
          value={formatCurrency(summary.totalExpense)}
          subtext="total spent"
        />
        <StatCard
          icon={DollarSign}
          label="Net"
          value={`${netIsPositive ? '' : '-'}${formatCurrency(Math.abs(summary.net))}`}
          subtext={netIsPositive ? 'profit' : 'loss'}
          highlight={netIsPositive}
        />
        <div className="flex items-center rounded-xl border border-border bg-card p-4">
          <SyncStripeButton syncState={syncState} />
        </div>
      </div>

      {/* ── Charts ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MonthlyChart data={monthlySeries} />
        <CategoryChart data={expensesByCategory} />
      </div>

      {/* ── Transactions ───────────────────────────────────────── */}
      <TransactionsTable transactions={transactions} clients={clients} />
    </div>
  )
}
