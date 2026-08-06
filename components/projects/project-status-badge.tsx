import { cn } from '@/lib/utils'

export type ProjectStatus = 'proposed' | 'active' | 'completed' | 'on_hold' | 'cancelled'

/**
 * Single source of truth for how each project status is labelled and coloured.
 * The badge and the inline status picker both read it, so a status can never
 * render one way in the list and another in the picker that changes it.
 */
export const PROJECT_STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; className: string; dotClassName: string }
> = {
  proposed:  { label: 'Proposed',  className: 'bg-violet-500/10 text-violet-700 dark:text-violet-400', dotClassName: 'bg-violet-500' },
  active:    { label: 'Active',    className: 'bg-green-500/10 text-green-700 dark:text-green-400',    dotClassName: 'bg-green-500' },
  on_hold:   { label: 'On Hold',   className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400', dotClassName: 'bg-yellow-500' },
  completed: { label: 'Completed', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',       dotClassName: 'bg-blue-500' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground',                        dotClassName: 'bg-muted-foreground/40' },
}

/** Lifecycle order, as offered in every status picker. */
export const PROJECT_STATUSES: ProjectStatus[] = [
  'proposed',
  'active',
  'on_hold',
  'completed',
  'cancelled',
]

const FALLBACK = {
  label: 'Unknown',
  className: 'bg-muted text-muted-foreground',
  dotClassName: 'bg-muted-foreground/40',
}

export function projectStatusConfig(status: string) {
  return PROJECT_STATUS_CONFIG[status as ProjectStatus] ?? { ...FALLBACK, label: status }
}

interface ProjectStatusBadgeProps {
  status: string
  className?: string
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  const cfg = projectStatusConfig(status)
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cfg.className, className)}>
      {cfg.label}
    </span>
  )
}
