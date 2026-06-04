import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { StageBreakdown, OpenStage } from '@/lib/dashboard'
import { formatCurrency } from '@/lib/dashboard/format'

const STAGE_LABELS: Record<OpenStage, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  proposal_sent: 'Proposal',
  negotiating: 'Negotiating',
}

const BAR_COLORS: Record<OpenStage, string> = {
  lead: 'bg-slate-300 dark:bg-slate-600',
  contacted: 'bg-sky-300 dark:bg-sky-600',
  proposal_sent: 'bg-violet-400 dark:bg-violet-600',
  negotiating: 'bg-amber-400 dark:bg-amber-500',
}

const DOT_COLORS: Record<OpenStage, string> = {
  lead: 'bg-slate-400 dark:bg-slate-500',
  contacted: 'bg-sky-500',
  proposal_sent: 'bg-violet-500',
  negotiating: 'bg-amber-500',
}

interface PipelineChartProps {
  stages: StageBreakdown[]
  totalPipelineValue: number
}

export function PipelineChart({ stages, totalPipelineValue }: PipelineChartProps) {
  const totalClients = stages.reduce((s, r) => s + r.count, 0)
  const hasData = totalPipelineValue > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Breakdown</CardTitle>
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Pipeline breakdown by stage</caption>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="pb-2 text-left font-medium">Stage</th>
                <th scope="col" className="pb-2 pr-0 text-right font-medium">Clients</th>
                <th scope="col" className="pb-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.stage} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <div className="flex items-center gap-2">
                      <span className={cn('size-2 shrink-0 rounded-full', DOT_COLORS[s.stage])} aria-hidden="true" />
                      {STAGE_LABELS[s.stage]}
                    </div>
                  </th>
                  <td className="py-2 pr-0 text-right tabular-nums text-muted-foreground">
                    {s.count > 0 ? s.count : <span className="text-muted-foreground/50">0</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {s.totalValue > 0 ? formatCurrency(s.totalValue) : <span className="text-muted-foreground/50">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border text-xs font-semibold">
                <th scope="row" className="pt-2 text-left font-semibold">Total</th>
                <td className="pt-2 pr-0 text-right tabular-nums">{totalClients}</td>
                <td className="pt-2 text-right tabular-nums">
                  {hasData ? formatCurrency(totalPipelineValue) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
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
