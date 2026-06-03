import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { StageBreakdown, StageProbabilities, OpenStage } from '@/lib/dashboard'
import { formatCurrency } from '@/lib/dashboard/format'

const STAGE_LABELS: Record<OpenStage, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  proposal_sent: 'Proposal',
  negotiating: 'Negotiating',
}

// Bar segment colours — warm/cool spread, light & dark modes
const BAR_COLORS: Record<OpenStage, string> = {
  lead: 'bg-slate-300 dark:bg-slate-600',
  contacted: 'bg-sky-300 dark:bg-sky-600',
  proposal_sent: 'bg-violet-400 dark:bg-violet-600',
  negotiating: 'bg-amber-400 dark:bg-amber-500',
}

// Dot colours used in the legend and table
const DOT_COLORS: Record<OpenStage, string> = {
  lead: 'bg-slate-400 dark:bg-slate-500',
  contacted: 'bg-sky-500',
  proposal_sent: 'bg-violet-500',
  negotiating: 'bg-amber-500',
}

interface PipelineChartProps {
  stages: StageBreakdown[]
  stageProbabilities: StageProbabilities
  totalPipelineValue: number
}

export function PipelineChart({ stages, stageProbabilities, totalPipelineValue }: PipelineChartProps) {
  const totalForecast = stages.reduce((s, r) => s + r.forecastContribution, 0)
  const totalClients = stages.reduce((s, r) => s + r.count, 0)
  const hasData = totalPipelineValue > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Breakdown</CardTitle>
        <CardDescription>
          Forecast&nbsp;=&nbsp;Σ&nbsp;(value&nbsp;×&nbsp;stage probability).
          Adjust probabilities in Settings.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* ── Stacked proportion bar ───────────────────────────────── */}
        <div className="flex h-5 w-full gap-0.5 overflow-hidden rounded-md">
          {hasData ? (
            stages.map((s) => {
              if (s.totalValue === 0) return null
              const pct = (s.totalValue / totalPipelineValue) * 100
              return (
                <div
                  key={s.stage}
                  style={{ width: `${pct}%` }}
                  title={`${STAGE_LABELS[s.stage]}: ${formatCurrency(s.totalValue)}`}
                  className={cn('h-full transition-all', BAR_COLORS[s.stage])}
                />
              )
            })
          ) : (
            <div className="h-full w-full rounded-md bg-muted/60" />
          )}
        </div>

        {/* ── Colour legend ────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {stages.map((s) => (
            <div key={s.stage} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('size-2 rounded-full', DOT_COLORS[s.stage])} />
              {STAGE_LABELS[s.stage]}
            </div>
          ))}
        </div>

        {/* ── Breakdown table ──────────────────────────────────────── */}
        <div className="w-full">
          {/* Header */}
          <div className="grid grid-cols-[1fr_3.5rem_5.5rem_3.5rem_5.5rem] gap-x-3 border-b border-border pb-2 text-xs font-medium text-muted-foreground">
            <span>Stage</span>
            <span className="text-right">Clients</span>
            <span className="text-right">Value</span>
            <span className="text-right">Prob.</span>
            <span className="text-right">Forecast</span>
          </div>

          {/* Stage rows */}
          {stages.map((s) => (
            <div
              key={s.stage}
              className="grid grid-cols-[1fr_3.5rem_5.5rem_3.5rem_5.5rem] gap-x-3 border-b border-border py-2 text-xs last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className={cn('size-2 shrink-0 rounded-full', DOT_COLORS[s.stage])} />
                <span>{STAGE_LABELS[s.stage]}</span>
              </div>
              <span className="text-right tabular-nums text-muted-foreground">
                {s.count > 0 ? s.count : <span className="text-muted-foreground/50">0</span>}
              </span>
              <span className="text-right tabular-nums">
                {s.totalValue > 0 ? formatCurrency(s.totalValue) : <span className="text-muted-foreground/50">—</span>}
              </span>
              <span className="text-right tabular-nums text-muted-foreground">
                {stageProbabilities[s.stage]}%
              </span>
              <span className="text-right tabular-nums font-medium">
                {s.forecastContribution > 0 ? (
                  formatCurrency(s.forecastContribution)
                ) : (
                  <span className="font-normal text-muted-foreground/50">—</span>
                )}
              </span>
            </div>
          ))}

          {/* Total row */}
          <div className="grid grid-cols-[1fr_3.5rem_5.5rem_3.5rem_5.5rem] gap-x-3 pt-2 text-xs font-semibold">
            <span>Total</span>
            <span className="text-right tabular-nums">{totalClients}</span>
            <span className="text-right tabular-nums">
              {hasData ? formatCurrency(totalPipelineValue) : '—'}
            </span>
            <span />
            <span className="text-right tabular-nums text-primary">
              {totalForecast > 0 ? formatCurrency(totalForecast) : '—'}
            </span>
          </div>
        </div>

        {!hasData && (
          <p className="text-center text-xs text-muted-foreground">
            Add clients with estimated values to see your pipeline breakdown.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
