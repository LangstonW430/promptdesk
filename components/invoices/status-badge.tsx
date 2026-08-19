import { cn } from '@/lib/utils'
import type { InvoiceStatus } from '@/lib/invoices/types'

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft:         'bg-muted text-muted-foreground',
  open:          'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  paid:          'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  uncollectible: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  void:          'bg-muted text-muted-foreground line-through',
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:         'Draft',
  // "Sent" rather than Stripe's "open": the operator's question is whether the
  // client has it, and every open invoice here has been finalized and emailed.
  open:          'Sent',
  paid:          'Paid',
  uncollectible: 'Written off',
  void:          'Void',
}

const OVERDUE_STYLE =
  'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'

/**
 * Overdue is drawn from the derived flag rather than the status.
 *
 * Stripe has no overdue state — an unpaid invoice past its due date is still
 * `open` — so it is a property of the invoice, not a value it can hold.
 */
export function StatusBadge({
  status,
  isOverdue = false,
}: {
  status: InvoiceStatus
  isOverdue?: boolean
}) {
  const overdue = isOverdue && status === 'open'

  return (
    <span
      // Marks the chip for the print rule in globals.css: it carries its own
      // colours rather than theme tokens, so a printed invoice would otherwise
      // show a dark-mode chip on a white sheet.
      data-invoice-status={overdue ? 'overdue' : status}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        overdue ? OVERDUE_STYLE : STATUS_STYLES[status],
      )}
    >
      {overdue ? 'Overdue' : STATUS_LABELS[status]}
    </span>
  )
}
