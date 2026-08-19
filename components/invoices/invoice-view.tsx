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
  const pub = isPublic(invoice) ? invoice : null
  // Falls back to the email address only when no business name is set — better
  // than an empty supplier line, but it is worth setting one in Settings.
  const fromName = pub ? (pub.ownerBusinessName ?? pub.ownerEmail) : null

  return (
    <div
      id="invoice-print-area"
      className="rounded-xl border border-border bg-card text-card-foreground shadow-sm print:shadow-none print:border-none print:rounded-none"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between p-8 border-b border-border print:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {/* Stripe assigns the number at finalization, so a draft has none. */}
            {invoice.number ?? 'Draft invoice'}
          </h1>
          {invoice.projectTitle && (
            <p className="mt-1 text-sm text-muted-foreground">{invoice.projectTitle}</p>
          )}
        </div>
        <StatusBadge status={invoice.status} isOverdue={invoice.isOverdue} />
      </div>

      {/* ── From / To / Dates ───────────────────────────────────────── */}
      {/* Three parties to the document: who is billing, who is billed, and the
          terms. The dates stay in one column — split across grid rows, issue
          and due read as unrelated facts. */}
      <div className="grid grid-cols-1 gap-8 p-8 border-b border-border print:p-6 sm:grid-cols-3">
        {showFrom && pub && fromName && (
          <div>
            <FieldLabel>From</FieldLabel>
            <p className="mt-1 text-sm font-medium text-foreground">{fromName}</p>
            {pub.ownerAddress && (
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {pub.ownerAddress}
              </p>
            )}
            {pub.ownerBusinessName && (
              <p className="text-sm text-muted-foreground">{pub.ownerEmail}</p>
            )}
            {pub.ownerPhone && (
              <p className="text-sm text-muted-foreground">{pub.ownerPhone}</p>
            )}
            {pub.ownerTaxNumber && (
              <p className="mt-1 text-sm text-muted-foreground">
                Tax ID {pub.ownerTaxNumber}
              </p>
            )}
          </div>
        )}

        <div>
          <FieldLabel>Bill To</FieldLabel>
          <p className="mt-1 text-sm font-medium text-foreground">
            {invoice.clientName ?? 'Unattributed'}
          </p>
          {invoice.clientEmail && (
            <p className="text-sm text-muted-foreground">{invoice.clientEmail}</p>
          )}
          {invoice.clientAddress && (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {invoice.clientAddress}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>Issue Date</FieldLabel>
            <p className="mt-1 text-sm text-foreground">{formatDate(invoice.issueDate)}</p>
          </div>

          <div>
            <FieldLabel>Due Date</FieldLabel>
            <p
              className={
                invoice.isOverdue
                  ? 'print-overdue mt-1 text-sm font-medium text-red-600 dark:text-red-400'
                  : 'mt-1 text-sm font-medium text-foreground'
              }
            >
              {/* Stripe invoices that charge automatically carry no due date. */}
              {invoice.dueDate ? formatDate(invoice.dueDate) : 'On receipt'}
            </p>
            {invoice.paymentTerms && (
              <p className="text-sm text-muted-foreground">{invoice.paymentTerms}</p>
            )}
          </div>

          {invoice.purchaseOrder && (
            <div>
              <FieldLabel>PO / Reference</FieldLabel>
              <p className="mt-1 text-sm text-foreground">{invoice.purchaseOrder}</p>
            </div>
          )}
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
                {/* The rate is only known on invoices raised after it started
                    being stored; older ones show the amount alone, as before. */}
                <span className="text-muted-foreground">
                  Tax{invoice.taxRate != null ? ` (${formatRate(invoice.taxRate)})` : ''}
                </span>
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

/** Trims a stored rate to how a person writes it: 8.5%, not 8.50%. */
function formatRate(rate: number): string {
  return `${Number(rate.toFixed(2))}%`
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
