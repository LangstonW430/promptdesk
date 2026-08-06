import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/auth'
import { listTransactions, fetchClientsForPicker } from '@/lib/finance'
import { getMonthlySeries } from '@/lib/finance/aggregates'
import { sumFinancials, groupByCategory } from '@/lib/finance/calc'
import { getSyncState, getActiveMRR } from '@/lib/finance/stripe-sync'
import { PeriodSelector } from '@/components/finance/period-selector'
import { MonthlyChart } from '@/components/finance/monthly-chart'
import { CategoryChart } from '@/components/finance/category-chart'
import { TransactionsTable } from '@/components/finance/transactions-table'
import { FinanceStatCards } from '@/components/finance/finance-stat-cards'
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

  const [activeMRR, monthlySeries, transactions, clients, syncState] =
    await Promise.all([
      getActiveMRR(ownerId),
      getMonthlySeries(ownerId, 6),
      // Scoped to the displayed period — the stat cards filter to this range
      // (and to `thisMonth`, which is always a subset of it) client-side.
      listTransactions(ownerId, { period }),
      fetchClientsForPicker(ownerId),
      getSyncState(ownerId),
    ])

  // Derived from the rows already in memory rather than re-queried.
  // getFinancialSummary and getExpensesByCategory ran the same owner+period
  // scan as listTransactions above and reduced it with these very functions,
  // so the page was reading the same transactions out of Postgres three times
  // per load. `sumFinancials` and `groupByCategory` are the pure reducers from
  // lib/finance/calc — same inputs, same outputs, no round-trip.
  const summary = sumFinancials(transactions)
  const expensesByCategory = groupByCategory(
    transactions.filter((t) => t.type === 'expense'),
  )

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

      {/* ── Stat cards + MRR ───────────────────────────────────── */}
      <FinanceStatCards
        summary={summary}
        activeMRR={activeMRR}
        transactions={transactions}
        period={period}
        syncState={syncState}
      />

      {/* ── Charts ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MonthlyChart data={monthlySeries} />
        <CategoryChart data={expensesByCategory} />
      </div>

      {/* ── Transactions ───────────────────────────────────────── */}
      <div id="transactions">
        <TransactionsTable transactions={transactions} clients={clients} />
      </div>
    </div>
  )
}
