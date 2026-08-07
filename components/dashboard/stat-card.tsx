import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  subtext?: string
  /** Tints the value with the primary accent colour — use for the headline metric. */
  highlight?: boolean
}

export function StatCard({ icon: Icon, label, value, subtext, highlight }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-4 text-primary" />
          </div>
        </div>
        <p
          className={cn(
            'text-2xl font-semibold tracking-tight',
            highlight && 'text-primary',
          )}
        >
          {value}
        </p>
        {subtext && (
          <p className="text-xs text-muted-foreground">{subtext}</p>
        )}
      </CardContent>
    </Card>
  )
}
