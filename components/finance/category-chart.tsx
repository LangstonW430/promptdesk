import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CategoryStat } from '@/lib/finance/types'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

// Simple repeating palette — enough for up to 8 expense categories
const BAR_COLORS = [
  'bg-violet-400 dark:bg-violet-500',
  'bg-sky-400 dark:bg-sky-500',
  'bg-amber-400 dark:bg-amber-500',
  'bg-pink-400 dark:bg-pink-500',
  'bg-teal-400 dark:bg-teal-500',
  'bg-orange-400 dark:bg-orange-500',
  'bg-indigo-400 dark:bg-indigo-500',
  'bg-lime-400 dark:bg-lime-500',
]

interface CategoryChartProps {
  data: CategoryStat[]
  title?: string
}

export function CategoryChart({ data, title = 'Expenses by Category' }: CategoryChartProps) {
  const total = data.reduce((s, d) => s + d.total, 0)
  const hasData = total > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!hasData ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No data for the selected period.
          </p>
        ) : (
          <>
            {/* Stacked bar */}
            <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-md" aria-hidden="true">
              {data.map((d, i) => {
                const pct = (d.total / total) * 100
                return (
                  <div
                    key={d.category}
                    className={`h-full transition-all ${BAR_COLORS[i % BAR_COLORS.length]}`}
                    style={{ width: `${pct}%` }}
                    title={`${d.category}: ${fmt(d.total)}`}
                  />
                )
              })}
            </div>

            {/* Rows */}
            <div className="flex flex-col gap-2">
              {data.map((d, i) => {
                const pct = Math.round((d.total / total) * 100)
                return (
                  <div key={d.category} className="flex items-center gap-2 text-xs">
                    <span
                      className={`size-2.5 shrink-0 rounded-sm ${BAR_COLORS[i % BAR_COLORS.length]}`}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-foreground">{d.category}</span>
                    <span className="text-muted-foreground tabular-nums">{pct}%</span>
                    <span className="w-20 text-right tabular-nums font-medium">{fmt(d.total)}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
