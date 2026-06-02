import { cn } from '@/lib/utils'
import type { ClientStatus } from '@/lib/clients/types'

const STATUS_CONFIG: Record<ClientStatus, { label: string; className: string }> = {
  lead: {
    label: 'Lead',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  contacted: {
    label: 'Contacted',
    className:
      'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  proposal_sent: {
    label: 'Proposal',
    className:
      'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
  negotiating: {
    label: 'Negotiating',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  won: {
    label: 'Won',
    className:
      'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  lost: {
    label: 'Lost',
    className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as ClientStatus] ?? {
    label: status,
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}
