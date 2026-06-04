import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MonthlyStat } from '@/lib/finance/types'

function fmt(n: number) {
  if (n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `$${Math.round(n / 1_000)}k`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

interface MonthlyChartProps {
  data: MonthlyStat[]
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1)
  const hasData = data.some((d) => d.income > 0 || d.expense > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Income vs Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No transactions recorded yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Bar chart */}
            <div className="flex items-end gap-1.5 h-36" aria-hidden="true">
              {data.map((d) => {
                const incomePct = (d.income / max) * 100
                const expensePct = (d.expense / max) * 100
                return (
                  <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full items-end justify-center gap-0.5 h-28">
                      <div
                        className="w-[45%] rounded-t-sm bg-emerald-400 dark:bg-emerald-500 transition-all"
                        style={{ height: `${Math.max(incomePct, 2)}%` }}
                        title={`Income: ${fmt(d.income)}`}
                      />
                      <div
                        className="w-[45%] rounded-t-sm bg-rose-400 dark:bg-rose-500 transition-all"
                        style={{ height: `${Math.max(expensePct, 2)}%` }}
                        title={`Expenses: ${fmt(d.expense)}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {d.label.split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-emerald-400 dark:bg-emerald-500" />
                Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-rose-400 dark:bg-rose-500" />
                Expenses
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">Monthly income and expenses</caption>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="pb-1.5 text-left font-medium">Month</th>
                    <th scope="col" className="pb-1.5 text-right font-medium">Income</th>
                    <th scope="col" className="pb-1.5 text-right font-medium">Expenses</th>
                    <th scope="col" className="pb-1.5 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d) => (
                    <tr key={d.label} className="border-b border-border last:border-0">
                      <td className="py-1.5 text-left">{d.label}</td>
                      <td className="py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {d.income > 0 ? fmt(d.income) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-rose-600 dark:text-rose-400">
                        {d.expense > 0 ? fmt(d.expense) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className={`py-1.5 text-right tabular-nums font-medium ${d.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {d.income === 0 && d.expense === 0
                          ? <span className="text-muted-foreground/50">—</span>
                          : fmt(Math.abs(d.net))
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
