import { StatusBadge } from './status-badge'
import type { SerializedInvoice, SerializedInvoicePublic } from '@/lib/invoices/types'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

type Props = {
  invoice: SerializedInvoice | SerializedInvoicePublic
  /** Shown in the From: block when viewing the public version */
  showFrom?: boolean
}

function isPublic(inv: SerializedInvoice | SerializedInvoicePublic): inv is SerializedInvoicePublic {
  return 'ownerEmail' in inv
}

/**
 * The invoice document itself, rendered both in the app and on the public page
 * a client opens.
 *
 * Every colour here is a theme token. It used to be hardcoded — `bg-white`,
 * `text-gray-900`, `border-gray-100` — so in dark mode it rendered as a glaring
 * white sheet inside a dark page, the one surface in the app that ignored the
 * theme. The greys also collapsed to two levels on the way: `text-gray-400` on
 * white is about 2.8:1, which the uppercase field labels failed WCAG AA on.
 *
 * Printing is handled in globals.css, which restates the light token values
 * inside `#invoice-print-area` under `@media print`. An invoice is a document:
 * whatever theme the sender happens to be using, the printed sheet and the PDF
 * have to come out dark-on-white.
 */
export function InvoiceView({ invoice, showFrom }: Props) {
  const fromName  = isPublic(invoice) ? (invoice.ownerBusinessName ?? invoice.ownerEmail) : null
  const fromEmail = isPublic(invoice) ? invoice.ownerEmail : null

  return (
    <div
      id="invoice-print-area"
      className="rounded-xl border border-border bg-card text-card-foreground shadow-sm print:shadow-none print:border-none print:rounded-none"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between p-8 border-b border-border print:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {invoice.invoiceNumberFormatted}
          </h1>
          {invoice.projectTitle && (
            <p className="mt-1 text-sm text-muted-foreground">{invoice.projectTitle}</p>
          )}
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      {/* ── From / To / Dates ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-8 p-8 border-b border-border print:p-6 sm:grid-cols-3">
        {showFrom && fromName && (
          <div>
            <FieldLabel>From</FieldLabel>
            <p className="mt-1 text-sm font-medium text-foreground">{fromName}</p>
            {fromEmail && <p className="text-sm text-muted-foreground">{fromEmail}</p>}
          </div>
        )}

        <div>
          <FieldLabel>Bill To</FieldLabel>
          <p className="mt-1 text-sm font-medium text-foreground">{invoice.clientName}</p>
        </div>

        <div>
          <FieldLabel>Issue Date</FieldLabel>
          <p className="mt-1 text-sm text-foreground">{formatDate(invoice.issueDate)}</p>
        </div>

        <div>
          <FieldLabel>Due Date</FieldLabel>
          <p
            className={
              invoice.status === 'overdue'
                ? 'print-overdue mt-1 text-sm font-medium text-red-600 dark:text-red-400'
                : 'mt-1 text-sm font-medium text-foreground'
            }
          >
            {formatDate(invoice.dueDate)}
          </p>
        </div>
      </div>

      {/* ── Line Items ──────────────────────────────────────────────── */}
      <div className="p-8 print:p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground w-20">Qty</th>
              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground w-28">Unit Price</th>
              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground w-28">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoice.lineItems.map((li) => (
              <tr key={li.id}>
                <td className="py-3 text-foreground">{li.description}</td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">{li.quantity}</td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(li.unitPrice)}</td>
                <td className="py-3 text-right tabular-nums font-medium text-foreground">{formatCurrency(li.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Totals ─────────────────────────────────────────────────── */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums text-foreground">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.tax != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums text-foreground">{formatCurrency(invoice.tax)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 font-semibold text-base text-foreground">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* ── Notes ──────────────────────────────────────────────────── */}
        {invoice.notes && (
          <div className="mt-8 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <FieldLabel className="mb-1">Notes</FieldLabel>
            <p className="whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={`text-xs font-semibold uppercase tracking-wide text-muted-foreground${
        className ? ` ${className}` : ''
      }`}
    >
      {children}
    </p>
  )
}
