import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/auth'
import { listTransactionsForPeriod, fetchClientsForPicker, fetchProjectsForPicker } from '@/lib/finance'
import { getPeriodSeries } from '@/lib/finance/aggregates'
import { sumFinancials, groupByCategory, groupByClient } from '@/lib/finance/calc'
import { getSyncState, getActiveMRR } from '@/lib/finance/stripe-sync'
import { PeriodSelector } from '@/components/finance/period-selector'
import { MonthlyChart } from '@/components/finance/monthly-chart'
import { BreakdownCard, type BreakdownView } from '@/components/finance/breakdown-card'
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

  const [activeMRR, series, transactions, clients, projects, syncState] =
    await Promise.all([
      getActiveMRR(ownerId),
      // Follows the period selector, so the chart and the stat cards above it
      // describe the same span. It used to be a fixed six months regardless.
      getPeriodSeries(ownerId, period),
      // Standing charges are expanded into their actual occurrences here, so
      // the table, the stat cards and the category breakdown all count a
      // recurring fee in every month it applies — matching the chart, which
      // was previously the only thing that did.
      listTransactionsForPeriod(ownerId, period),
      fetchClientsForPicker(ownerId),
      fetchProjectsForPicker(ownerId),
      getSyncState(ownerId),
    ])

  // Derived from the rows already in memory rather than re-queried.
  // getFinancialSummary and getExpensesByCategory ran the same owner+period
  // scan as listTransactions above and reduced it with these very functions,
  // so the page was reading the same transactions out of Postgres three times
  // per load. `sumFinancials` and `groupByCategory` are the pure reducers from
  // lib/finance/calc — same inputs, same outputs, no round-trip.
  const summary = sumFinancials(transactions)

  // Both breakdowns come off the same expanded rows, so the tabs cannot report
  // different totals for the same period. groupByClient already existed and had
  // no caller — the data for "who pays me" was being loaded and thrown away.
  const breakdowns: BreakdownView[] = [
    {
      id: 'expense-category',
      label: 'Expenses',
      title: 'Expenses by Category',
      data: groupByCategory(transactions.filter((t) => t.type === 'expense')),
      empty: 'No expenses in this period.',
    },
    {
      id: 'income-client',
      label: 'Income',
      title: 'Income by Client',
      data: groupByClient(transactions).map((c) => ({
        category: c.clientName ?? 'Unattributed',
        total: c.total,
        count: 0,
      })),
      empty: 'No income in this period.',
    },
  ]

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
        <MonthlyChart data={series.points} unit={series.granularity} />
        <BreakdownCard views={breakdowns} />
      </div>

      {/* ── Transactions ───────────────────────────────────────── */}
      <div id="transactions">
        <TransactionsTable transactions={transactions} clients={clients} projects={projects} />
      </div>
    </div>
  )
}
