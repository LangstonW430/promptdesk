'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useTransition } from 'react'
import { FileText, Archive, RotateCcw, AlertCircle } from 'lucide-react'
import { StatusBadge } from './status-badge'
import { setInvoiceArchivedAction } from '@/lib/actions/invoices'
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

/**
 * What to call an invoice in a list.
 *
 * Stripe assigns the number at finalization, so a draft genuinely has none yet.
 * "Draft" is the honest label yet — inventing a placeholder number would
 * suggest a reference the client could quote.
 */
function invoiceLabel(inv: SerializedInvoice): string {
  return inv.number ?? 'Draft'
}

export function InvoiceList({
  invoices,
  isArchivedView = false,
}: {
  invoices: SerializedInvoice[]
  isArchivedView?: boolean
}) {
  const router = useRouter()

  // Rows the user has just archived/restored. Archiving moves an invoice out
  // of whichever list is on screen, so the row is hidden the moment the action
  // is dispatched rather than after the server round-trip. Cleared whenever
  // fresh server data arrives, which is the authoritative list.
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set())
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [, startArchiveTransition] = useTransition()

  useEffect(() => {
    setRemovedIds(new Set())
  }, [invoices])

  const visibleInvoices = invoices.filter((inv) => !removedIds.has(inv.id))

  function handleArchiveToggle(invoice: SerializedInvoice) {
    // In the Archived view the same control restores instead.
    const archived = !isArchivedView

    setArchiveError(null)
    setRemovedIds((prev) => new Set(prev).add(invoice.id))

    startArchiveTransition(async () => {
      const result = await setInvoiceArchivedAction(invoice.id, { archived })
      if (!result.success) {
        setRemovedIds((prev) => {
          const next = new Set(prev)
          next.delete(invoice.id)
          return next
        })
        setArchiveError(
          `Couldn't ${archived ? 'archive' : 'restore'} ${invoiceLabel(invoice)}. ${result.error ?? 'Please try again.'}`,
        )
        return
      }
      router.refresh()
    })
  }

  if (visibleInvoices.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {archiveError && <ArchiveError message={archiveError} />}
        {isArchivedView ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Archive className="mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              No archived invoices
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground/60">
              Archiving an invoice files it away without deleting it. Its number,
              share link, and any linked payment stay intact.
            </p>
            <Link
              href="/invoices"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Back to active invoices
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No invoices yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground/60">
              Create an invoice from scratch, or go to the Time page and convert logged hours directly into a bill.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Create invoice
              </Link>
              <Link
                href="/time"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Log time first
              </Link>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {archiveError && <ArchiveError message={archiveError} />}

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
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleInvoices.map((inv) => (
              <tr key={inv.id} className="group transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {invoiceLabel(inv)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {inv.clientName ?? (
                    <span className="italic text-muted-foreground/50">No customer name</span>
                  )}
                  {/* Imported from Stripe, billed to somebody who matches no
                      client in the CRM. Says which, rather than just "not
                      linked", because the useful question is what to do about
                      it — and the answer is on the invoice's own page. */}
                  {!inv.clientId && (
                    <span
                      className="ml-1.5 whitespace-nowrap text-xs text-muted-foreground/60"
                      title={
                        'From Stripe. ' +
                        (inv.clientEmail
                          ? `Billed to ${inv.clientEmail}, which matches no client in your CRM. `
                          : 'No billing email to match on. ') +
                        'Open the invoice to link it to a client — its payments will then ' +
                        'be attributed to them and their projects.'
                      }
                    >
                      · not a client yet
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatDate(inv.issueDate)}</td>
                <td className={`px-4 py-3 hidden sm:table-cell ${inv.isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                  {inv.dueDate ? formatDate(inv.dueDate) : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={inv.status} isOverdue={inv.isOverdue} />
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatCurrency(inv.total)}
                </td>

                {/* Row actions. Revealed on hover, and on keyboard focus so the
                    control is reachable without a pointer — it stays in the tab
                    order either way. */}
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleArchiveToggle(inv)}
                    aria-label={`${isArchivedView ? 'Restore' : 'Archive'} invoice ${invoiceLabel(inv)}`}
                    title={`${isArchivedView ? 'Restore' : 'Archive'} ${invoiceLabel(inv)}`}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
                  >
                    {isArchivedView ? (
                      <RotateCcw className="size-3.5" />
                    ) : (
                      <Archive className="size-3.5" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ArchiveError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {message}
    </div>
  )
}
