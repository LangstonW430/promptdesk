import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { foldCategoryTail, OTHER_CATEGORY } from '@/lib/finance/calc'
import type { CategoryStat } from '@/lib/finance/types'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

// Categorical slots, assigned in fixed order — index 0 always gets slot 1, so a
// category keeps its colour regardless of how many others are on screen. The
// previous version indexed with `i % COLORS.length`, which wrapped the ninth
// category back onto the first one's colour and repainted every slice whenever
// the period filter changed the category count.
const SLOTS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
] as const

// Past this many, colours stop being reliably separable — the remainder folds
// into one neutral "Other" bucket rather than getting a generated hue.
const MAX_SLICES = SLOTS.length

function colorFor(category: string, index: number): string {
  return category === OTHER_CATEGORY
    ? 'var(--chart-other)'
    : SLOTS[index] ?? 'var(--chart-other)'
}

interface CategoryChartProps {
  data: CategoryStat[]
  title?: string
}

export function CategoryChart({ data, title = 'Expenses by Category' }: CategoryChartProps) {
  const total = data.reduce((s, d) => s + d.total, 0)
  const hasData = total > 0
  const slices = hasData ? foldCategoryTail(data, MAX_SLICES) : []

  // How many categories the bucket absorbed. NOT `stat.count` — that is a
  // transaction count, so reading it as a category count overstated the fold
  // badly (three folded categories holding sixteen transactions rendered as
  // "16 categories"). The fold swaps N rows for one, so N is the difference.
  const foldedCount = data.length - slices.length + 1

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
            {/* Stacked bar. The 2px gaps are the surface doing the separating —
                no border is drawn around the segments. */}
            <div
              className="flex h-4 w-full gap-0.5 overflow-hidden rounded-md"
              aria-hidden="true"
            >
              {slices.map((d, i) => (
                <div
                  key={d.category}
                  className="h-full"
                  style={{
                    width: `${(d.total / total) * 100}%`,
                    backgroundColor: colorFor(d.category, i),
                  }}
                />
              ))}
            </div>

            {/* Every value is also readable here, so the bar is never the only
                way to read the data — which is also the relief for the slots
                that sit under 3:1 on the light surface. */}
            <ul className="flex flex-col gap-2">
              {slices.map((d, i) => (
                <li key={d.category} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: colorFor(d.category, i) }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-foreground">
                    {d.category}
                    {d.category === OTHER_CATEGORY && foldedCount > 1 && (
                      <span className="ml-1 text-muted-foreground">
                        ({foldedCount} categories)
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.round((d.total / total) * 100)}%
                  </span>
                  <span className="w-20 text-right font-medium tabular-nums">
                    {fmt(d.total)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
