import { cn } from '@/lib/utils'
import type { InvoiceStatus } from '@/lib/invoices/types'

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft:    'bg-muted text-muted-foreground',
  sent:     'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  paid:     'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  overdue:  'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:   'Draft',
  sent:    'Sent',
  paid:    'Paid',
  overdue: 'Overdue',
}

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      // Marks the chip for the print rule in globals.css: it carries its own
      // colours rather than theme tokens, so a printed invoice would otherwise
      // show a dark-mode chip on a white sheet.
      data-invoice-status={status}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
