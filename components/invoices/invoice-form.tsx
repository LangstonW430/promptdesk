'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createInvoiceAction, createInvoiceFromEntriesAction } from '@/lib/actions/invoices'
import type { LineItem } from '@/lib/invoices/types'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Terms that imply a due date. Anything not listed here (free text) leaves the
 * date alone — the operator sets it themselves.
 */
const TERMS_PRESETS: Record<string, number> = {
  'Due on receipt': 0,
  'Net 7': 7,
  'Net 14': 14,
  'Net 30': 30,
  'Net 60': 60,
}

function addDaysISO(fromISO: string, days: number) {
  const [y, m, d] = fromISO.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0, amount: 0 }
}

type Client = { id: string; name: string }

type Props = {
  clients: Client[]
  /** The operator's default terms, from settings. */
  defaultTerms: string | null
  /** Pre-populated when coming from the time-entry flow */
  prefill?: {
    entryIds: string[]
    clientId: string
    lineItems: LineItem[]
  }
}

export function InvoiceForm({ clients, defaultTerms, prefill }: Props) {
  const router   = useRouter()
  const [isPending, startTransition] = useTransition()

  const [clientId,   setClientId]   = useState(prefill?.clientId ?? '')
  const [issueDate,  setIssueDate]  = useState(todayISO())
  const [terms,      setTerms]      = useState(defaultTerms ?? 'Net 30')
  const [dueDate,    setDueDate]    = useState(() =>
    addDaysISO(todayISO(), TERMS_PRESETS[defaultTerms ?? 'Net 30'] ?? 30),
  )
  const [taxPct,     setTaxPct]     = useState('')
  const [purchaseOrder, setPurchaseOrder] = useState('')
  const [notes,      setNotes]      = useState('')

  // Terms and the issue date together decide the due date, but only for terms
  // that actually imply one. A free-text term leaves whatever is in the field.
  function applyTerms(nextTerms: string, nextIssue = issueDate) {
    setTerms(nextTerms)
    const days = TERMS_PRESETS[nextTerms]
    if (days !== undefined) setDueDate(addDaysISO(nextIssue, days))
  }

  function handleIssueDateChange(next: string) {
    setIssueDate(next)
    const days = TERMS_PRESETS[terms]
    if (days !== undefined) setDueDate(addDaysISO(next, days))
  }
  const [lineItems,  setLineItems]  = useState<LineItem[]>(
    prefill?.lineItems && prefill.lineItems.length > 0
      ? prefill.lineItems
      : [newLineItem()],
  )
  const [error, setError] = useState<string | null>(null)

  const isFromEntries = !!prefill?.entryIds?.length

  // ── Line item helpers ────────────────────────────────────────────────────────

  function updateLineItem(id: string, patch: Partial<LineItem>) {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li
        const next = { ...li, ...patch }
        next.amount = Math.round(next.quantity * next.unitPrice * 100) / 100
        return next
      }),
    )
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((li) => li.id !== id))
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, newLineItem()])
  }

  // ── Totals ───────────────────────────────────────────────────────────────────

  const subtotal   = lineItems.reduce((s, li) => s + li.amount, 0)
  const taxAmount  = taxPct !== '' && !Number.isNaN(Number(taxPct)) && Number(taxPct) > 0
    ? Math.round(subtotal * Number(taxPct)) / 100
    : null
  const total      = subtotal + (taxAmount ?? 0)

  // ── Submit ───────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!clientId) { setError('Please select a client'); return }
    if (lineItems.some((li) => !li.description.trim())) {
      setError('All line items need a description'); return
    }

    const taxNum = taxPct !== '' && !Number.isNaN(Number(taxPct)) ? Number(taxPct) : null

    startTransition(async () => {
      let result

      if (isFromEntries) {
        result = await createInvoiceFromEntriesAction({
          entryIds: prefill!.entryIds,
          issueDate,
          dueDate,
          tax: taxNum,
          paymentTerms: terms.trim() || null,
          purchaseOrder: purchaseOrder.trim() || null,
          notes: notes.trim() || null,
        })
      } else {
        result = await createInvoiceAction({
          clientId,
          lineItems,
          issueDate,
          dueDate,
          tax: taxNum,
          paymentTerms: terms.trim() || null,
          purchaseOrder: purchaseOrder.trim() || null,
          notes: notes.trim() || null,
        })
      }

      if (!result.success) {
        setError(result.error ?? 'Failed to create invoice')
        return
      }

      router.push(`/invoices/${result.data.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Client + Dates ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border p-6 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Client *</label>
          {isFromEntries ? (
            <p className="text-sm font-medium">
              {clients.find((c) => c.id === clientId)?.name ?? clientId}
            </p>
          ) : (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Issue Date *</label>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => handleIssueDateChange(e.target.value)}
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Due Date *</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="terms" className="text-xs font-medium text-muted-foreground">
            Payment Terms
          </label>
          <input
            id="terms"
            list="invoice-terms"
            value={terms}
            onChange={(e) => applyTerms(e.target.value)}
            placeholder="Net 30"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <datalist id="invoice-terms">
            {Object.keys(TERMS_PRESETS).map((t) => <option key={t} value={t} />)}
          </datalist>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Sets the due date. Printed on the invoice.
          </p>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="po" className="text-xs font-medium text-muted-foreground">
            PO / Reference
          </label>
          <input
            id="po"
            type="text"
            value={purchaseOrder}
            onChange={(e) => setPurchaseOrder(e.target.value)}
            placeholder="Their purchase order number, if they gave you one"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* ── Line Items ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-muted/40 px-4 py-3 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Line Items</p>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_80px_100px_100px_36px] gap-2 px-4 py-2 text-xs text-muted-foreground border-b border-border/60 bg-muted/20">
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit Price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        <div className="divide-y divide-border/40">
          {lineItems.map((li, idx) => (
            <div
              key={li.id}
              className="grid grid-cols-[1fr_80px_100px_100px_36px] gap-2 px-4 py-2.5 items-center"
            >
              <input
                type="text"
                value={li.description}
                onChange={(e) => updateLineItem(li.id, { description: e.target.value })}
                placeholder="Description"
                disabled={isFromEntries}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <input
                type="number"
                value={li.quantity}
                min="0"
                step="0.01"
                onChange={(e) => updateLineItem(li.id, { quantity: Number(e.target.value) })}
                disabled={isFromEntries}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <input
                type="number"
                value={li.unitPrice}
                min="0"
                step="0.01"
                onChange={(e) => updateLineItem(li.id, { unitPrice: Number(e.target.value) })}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-right tabular-nums text-sm font-medium pr-1">
                {formatCurrency(li.amount)}
              </span>
              <button
                type="button"
                onClick={() => removeLineItem(li.id)}
                disabled={lineItems.length === 1 || isPending}
                aria-label={`Remove line item ${idx + 1}`}
                className="flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        {!isFromEntries && (
          <div className="border-t border-border/40 px-4 py-2.5">
            <button
              type="button"
              onClick={addLineItem}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="size-3.5" />
              Add line item
            </button>
          </div>
        )}
      </div>

      {/* ── Tax + Totals ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-6 sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4 sm:max-w-xs w-full">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tax Rate (%)</label>
            <input
              type="number"
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
              placeholder="e.g. 8.5"
              min="0"
              max="100"
              step="0.01"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Payment instructions, bank details, or any other notes…"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 w-full sm:w-64 space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          {taxAmount != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({taxPct}%)</span>
              <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-semibold text-base">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Create Invoice
        </Button>
      </div>
    </form>
  )
}
