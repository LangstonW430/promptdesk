'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import { StatusBadge } from './status-badge'
import type { SerializedInvoice } from '@/lib/invoices/types'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(n)
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function InvoiceList({ invoices }: { invoices: SerializedInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No invoices yet</p>
        <p className="mt-1 text-xs text-muted-foreground/60 max-w-xs">
          Create an invoice from scratch, or go to the Time page and convert logged hours directly into a bill.
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/invoices/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create invoice
          </Link>
          <Link
            href="/time"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Log time first
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Client</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Issued</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Due</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              className="group hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/invoices/${inv.id}`}
                  className="font-medium text-foreground hover:text-primary transition-colors"
                >
                  {inv.invoiceNumberFormatted}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{inv.clientName}</td>
              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatDate(inv.issueDate)}</td>
              <td className={`px-4 py-3 hidden sm:table-cell ${inv.status === 'overdue' ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                {formatDate(inv.dueDate)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={inv.status} />
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {formatCurrency(inv.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
