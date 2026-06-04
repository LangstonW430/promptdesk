import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RecentActivity } from '@/lib/dashboard'
import { relativeTime, formatStatus } from '@/lib/dashboard/format'

const DOT_COLORS: Record<string, string> = {
  status_changed: 'bg-primary',
  note_added: 'bg-slate-400 dark:bg-slate-500',
  followup_done: 'bg-green-500',
  prompt_generated: 'bg-violet-500',
}

function describeActivity(type: string, detail: unknown): string {
  const d =
    detail !== null && typeof detail === 'object' && !Array.isArray(detail)
      ? (detail as Record<string, unknown>)
      : {}
  switch (type) {
    case 'status_changed':
      return `moved to ${formatStatus(String(d.to ?? ''))}`
    case 'note_added':
      return 'note added'
    case 'followup_done':
      return 'follow-up completed'
    case 'prompt_generated':
      return 'prompt generated'
    default:
      return type.replace(/_/g, ' ')
  }
}

interface ActivityFeedProps {
  activities: RecentActivity[]
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No activity yet. Add clients and start working your pipeline.
            </p>
            <Link href="/clients/new" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Add first client →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {activities.map((a, i) => (
              <div
                key={a.id}
                className={cn(
                  'flex items-start gap-3 py-3',
                  i < activities.length - 1 && 'border-b border-border',
                )}
              >
                {/* Coloured dot */}
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    DOT_COLORS[a.type] ?? 'bg-muted-foreground',
                  )}
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    {a.clientName ? (
                      <span className="font-medium">{a.clientName}</span>
                    ) : (
                      <span className="font-medium text-muted-foreground">System</span>
                    )}
                    {' '}
                    <span className="text-muted-foreground">
                      {describeActivity(a.type, a.detail)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {relativeTime(a.createdAt)}
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
