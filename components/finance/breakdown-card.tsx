'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { foldCategoryTail, OTHER_CATEGORY } from '@/lib/finance/calc'
import type { CategoryStat } from '@/lib/finance/types'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

// Categorical slots, assigned in fixed order and never cycled, so a slice keeps
// its colour regardless of how many others are on screen.
const SLOTS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
  'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)',
] as const

const MAX_SLICES = SLOTS.length

function colorFor(name: string, index: number): string {
  return name === OTHER_CATEGORY ? 'var(--chart-other)' : SLOTS[index] ?? 'var(--chart-other)'
}

export interface BreakdownView {
  id: string
  /** Tab label. */
  label: string
  /** Heading shown above the bar, naming what is being split. */
  title: string
  data: CategoryStat[]
  /** Shown when this view has nothing in it. */
  empty: string
}

/**
 * One card, several breakdowns.
 *
 * The finance page had a single "Expenses by Category" chart and no way to see
 * income split by client, even though the data for it was already being loaded.
 * Adding a second card would have meant a third chart competing for the same
 * row; a tab strip puts the extra view in the space the card already occupies.
 *
 * These tabs pick which dimension to split by. They are not a filter — the
 * period selector above still scopes every figure on the page, so the views
 * never disagree about which slice of time they describe.
 */
export function BreakdownCard({ views }: { views: BreakdownView[] }) {
  const [activeId, setActiveId] = useState(views[0]?.id)
  const view = views.find((v) => v.id === activeId) ?? views[0]
  if (!view) return null

  const total = view.data.reduce((s, d) => s + d.total, 0)
  const hasData = total > 0
  const slices = hasData ? foldCategoryTail(view.data, MAX_SLICES) : []
  const foldedCount = view.data.length - slices.length + 1

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{view.title}</CardTitle>

        {views.length > 1 && (
          <div
            role="tablist"
            aria-label="Breakdown dimension"
            className="flex shrink-0 gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5"
          >
            {views.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={v.id === view.id}
                onClick={() => setActiveId(v.id)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none',
                  'focus-visible:ring-2 focus-visible:ring-ring/50',
                  v.id === view.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {!hasData ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{view.empty}</p>
        ) : (
          <>
            {/* Stacked bar. The 2px gaps are the surface separating the
                segments — no border is drawn around them. */}
            <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-md" aria-hidden="true">
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

            {/* Every value is readable here too, so the bar is never the only
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
                  <span className="flex-1 truncate text-foreground">
                    {d.category}
                    {d.category === OTHER_CATEGORY && foldedCount > 1 && (
                      <span className="ml-1 text-muted-foreground">({foldedCount} more)</span>
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.round((d.total / total) * 100)}%
                  </span>
                  <span className="w-20 text-right font-medium tabular-nums">{fmt(d.total)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
