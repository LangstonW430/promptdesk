import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { RecommendedAction } from '@/lib/daily-actions'

const DOT: Record<RecommendedAction['type'], string> = {
  overdue_followup: 'bg-red-500',
  going_cold: 'bg-sky-400',
  hot_lead: 'bg-amber-500',
  retainer_due: 'bg-violet-500',
}

const LABEL: Record<RecommendedAction['type'], string> = {
  overdue_followup: 'Overdue',
  going_cold: 'Going cold',
  hot_lead: 'Hot lead',
  retainer_due: 'Retainer due',
}

interface RecommendedActionsProps {
  actions: RecommendedAction[]
}

export function RecommendedActions({ actions }: RecommendedActionsProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Recommended Actions</CardTitle>
        <CardAction>
          <Link
            href="/daily-actions"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent>
        {actions.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">
            Nothing urgent — you&apos;re all caught up!
          </p>
        ) : (
          <div className="flex flex-col">
            {actions.map((a, i) => (
              <div
                key={`${a.clientId}-${a.type}`}
                className={cn(
                  'flex items-start gap-2.5 py-2.5',
                  i < actions.length - 1 && 'border-b border-border',
                )}
              >
                <span
                  className={cn(
                    'mt-[3px] size-2 shrink-0 rounded-full',
                    DOT[a.type],
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{a.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="mr-1 font-medium">{LABEL[a.type]}</span>
                    {a.context}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
