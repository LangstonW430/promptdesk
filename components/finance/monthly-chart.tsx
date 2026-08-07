'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendChart } from './trend-chart'
import { cn } from '@/lib/utils'
import type { MonthlyStat } from '@/lib/finance/types'

function fmt(n: number) {
  if (n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `$${Math.round(n / 1_000)}k`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const INCOME = 'var(--chart-income)'
const EXPENSE = 'var(--chart-expense)'

interface MonthlyChartProps {
  data: MonthlyStat[]
}

type View = 'bars' | 'trend'

const VIEWS: { id: View; label: string }[] = [
  { id: 'bars',  label: 'Monthly' },
  { id: 'trend', label: 'Trend' },
]

export function MonthlyChart({ data }: MonthlyChartProps) {
  const [view, setView] = useState<View>('bars')
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1)
  const hasData = data.some((d) => d.income > 0 || d.expense > 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>
          {view === 'bars' ? 'Monthly Income vs Expenses' : 'Income, Net & Expenses'}
        </CardTitle>

        {/* Two readings of the same months: the columns compare each month on
            its own, the lines show which way the numbers are heading. A tab
            strip keeps both in the footprint one chart already occupies. */}
        <div
          role="tablist"
          aria-label="Chart view"
          className="flex shrink-0 gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={v.id === view}
              onClick={() => setView(v.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring/50',
                v.id === view
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No transactions recorded yet.
          </p>
        ) : view === 'trend' ? (
          <div className="flex flex-col gap-4">
            <TrendChart data={data} />
            <MonthlyTable data={data} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Columns. A zero month renders no bar at all — the previous
                `Math.max(pct, 2)` floor drew a visible stub for $0, so an empty
                month was indistinguishable from a small one. */}
            <div className="flex h-36 items-end gap-1.5" aria-hidden="true">
              {data.map((d) => (
                <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                  {/* gap-0.5 is the 2px surface gap between the paired columns:
                      the surface separates them, not a stroke. */}
                  <div className="flex h-28 w-full max-w-14 items-end justify-center gap-0.5">
                    <Column value={d.income} max={max} color={INCOME} />
                    <Column value={d.expense} max={max} color={EXPENSE} />
                  </div>
                  <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                    {d.label.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>

            {/* Two series, so a legend is always present — identity never rests
                on colour matching alone. */}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <LegendKey color={INCOME} label="Income" />
              <LegendKey color={EXPENSE} label="Expenses" />
            </div>

            <MonthlyTable data={data} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * One column. Rounded at the data end, square at the baseline, and absent
 * entirely at zero.
 */
function Column({ value, max, color }: { value: number; max: number; color: string }) {
  if (value <= 0) return <div className="w-[45%]" />
  return (
    <div
      className="w-[45%] rounded-t"
      style={{ height: `${(value / max) * 100}%`, backgroundColor: color }}
    />
  )
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-2.5 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}

function Cell({ value }: { value: number }) {
  return (
    <td className="py-1.5 text-right tabular-nums">
      {value > 0 ? fmt(value) : <span className="text-muted-foreground/50">—</span>}
    </td>
  )
}

/**
 * The table view, shared by both charts. Every value either one plots is
 * readable here, so neither is the only way to reach a number.
 */
function MonthlyTable({ data }: { data: MonthlyStat[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">Monthly income, expenses and net</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="pb-1.5 text-left font-medium">Month</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Income</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Expenses</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const empty = d.income === 0 && d.expense === 0
            return (
              <tr key={d.label} className="border-b border-border last:border-0">
                <th scope="row" className="py-1.5 text-left font-normal">{d.label}</th>
                <Cell value={d.income} />
                <Cell value={d.expense} />
                {/* Text stays in text tokens rather than wearing the series
                    colour, which is not legible as text on the card surface.
                    The sign rides an explicit +/− prefix so it survives
                    greyscale and CVD. */}
                <td className="py-1.5 text-right font-medium tabular-nums">
                  {empty ? (
                    <span className="text-muted-foreground/50">—</span>
                  ) : (
                    `${d.net < 0 ? '−' : '+'}${fmt(Math.abs(d.net))}`
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
