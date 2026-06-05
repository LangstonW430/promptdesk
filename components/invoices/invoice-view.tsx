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

export function InvoiceView({ invoice, showFrom }: Props) {
  const fromName  = isPublic(invoice) ? (invoice.ownerBusinessName ?? invoice.ownerEmail) : null
  const fromEmail = isPublic(invoice) ? invoice.ownerEmail : null

  return (
    <div
      id="invoice-print-area"
      className="bg-white text-gray-900 rounded-xl border border-border shadow-sm print:shadow-none print:border-none print:rounded-none"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between p-8 border-b border-gray-100 print:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {invoice.invoiceNumberFormatted}
          </h1>
          {invoice.projectTitle && (
            <p className="mt-1 text-sm text-gray-500">{invoice.projectTitle}</p>
          )}
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      {/* ── From / To / Dates ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-8 p-8 border-b border-gray-100 print:p-6 sm:grid-cols-3">
        {showFrom && fromName && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">From</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{fromName}</p>
            {fromEmail && <p className="text-sm text-gray-500">{fromEmail}</p>}
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Bill To</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{invoice.clientName}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Issue Date</p>
          <p className="mt-1 text-sm text-gray-900">{formatDate(invoice.issueDate)}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Due Date</p>
          <p className={`mt-1 text-sm font-medium ${invoice.status === 'overdue' ? 'text-red-600' : 'text-gray-900'}`}>
            {formatDate(invoice.dueDate)}
          </p>
        </div>
      </div>

      {/* ── Line Items ──────────────────────────────────────────────── */}
      <div className="p-8 print:p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Description</th>
              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 w-20">Qty</th>
              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 w-28">Unit Price</th>
              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 w-28">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoice.lineItems.map((li) => (
              <tr key={li.id}>
                <td className="py-3 text-gray-900">{li.description}</td>
                <td className="py-3 text-right tabular-nums text-gray-600">{li.quantity}</td>
                <td className="py-3 text-right tabular-nums text-gray-600">{formatCurrency(li.unitPrice)}</td>
                <td className="py-3 text-right tabular-nums font-medium text-gray-900">{formatCurrency(li.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Totals ─────────────────────────────────────────────────── */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.tax != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tax</span>
                <span className="tabular-nums">{formatCurrency(invoice.tax)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold text-base">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* ── Notes ──────────────────────────────────────────────────── */}
        {invoice.notes && (
          <div className="mt-8 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Notes</p>
            <p className="whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
