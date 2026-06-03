import { Card, CardContent } from '@/components/ui/card'

interface ConversionMetricProps {
  rate: number | null
  wonCount: number
  lostCount: number
}

export function ConversionMetric({ rate, wonCount, lostCount }: ConversionMetricProps) {
  const pct = rate !== null ? Math.round(rate * 100) : null

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>

        <p className="text-2xl font-semibold tracking-tight">
          {pct !== null ? `${pct}%` : '—'}
        </p>

        {/* Won/lost mini-bar */}
        {(wonCount > 0 || lostCount > 0) && (
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
            {pct !== null && (
              <div
                className="bg-green-500 transition-all dark:bg-green-600"
                style={{ width: `${pct}%` }}
              />
            )}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-green-500 dark:bg-green-600" />
            {wonCount} won
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-red-400 dark:bg-red-500" />
            {lostCount} lost
          </span>
          {wonCount === 0 && lostCount === 0 && (
            <span className="italic">No closed deals yet</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
