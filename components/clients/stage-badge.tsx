import { cn } from '@/lib/utils'
import { CLIENT_STAGE_LABELS, type ClientStage } from '@/lib/clients/stage'

const STAGE_CLASS: Record<ClientStage, string> = {
  lead: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  contacted: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  proposal_out: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  active: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  past: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  lost: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const FALLBACK = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'

/**
 * Where a client sits, derived from their projects and contact history rather
 * than set by hand — so this only ever displays, never edits. Moving a client
 * along means quoting them, starting the work, or archiving them.
 */
export function StageBadge({
  stage,
  className,
}: {
  stage: string
  className?: string
}) {
  const label = CLIENT_STAGE_LABELS[stage as ClientStage] ?? stage
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STAGE_CLASS[stage as ClientStage] ?? FALLBACK,
        className,
      )}
    >
      {label}
    </span>
  )
}
