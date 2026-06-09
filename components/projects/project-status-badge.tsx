import { cn } from '@/lib/utils'

export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled'

const config: Record<ProjectStatus, { label: string; className: string }> = {
  active:    { label: 'Active',     className: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  completed: { label: 'Completed',  className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  on_hold:   { label: 'On Hold',    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' },
  cancelled: { label: 'Cancelled',  className: 'bg-muted text-muted-foreground' },
}

interface ProjectStatusBadgeProps {
  status: string
  className?: string
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  const cfg = config[status as ProjectStatus] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cfg.className, className)}>
      {cfg.label}
    </span>
  )
}
