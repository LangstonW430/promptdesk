'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Send, Link2, Printer, Loader2, Trash2, AlertCircle, Copy, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateInvoiceStatusAction, markInvoicePaidAction, deleteInvoiceAction } from '@/lib/actions/invoices'
import type { SerializedInvoice } from '@/lib/invoices/types'

type Props = {
  invoice: SerializedInvoice
  publicUrl: string
  promptText: string | null
}

export function InvoiceActions({ invoice, publicUrl, promptText }: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)

  const isPaid = invoice.status === 'paid'

  async function handleStatus(status: 'draft' | 'sent') {
    setError(null)
    start(async () => {
      const res = await updateInvoiceStatusAction(invoice.id, { status })
      if (!res.success) setError(res.error ?? 'Failed')
      else router.refresh()
    })
  }

  async function handleMarkPaid() {
    setError(null)
    start(async () => {
      const res = await markInvoicePaidAction(invoice.id)
      if (!res.success) setError(res.error ?? 'Failed')
      else router.refresh()
    })
  }

  async function handleDelete() {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    setError(null)
    start(async () => {
      const res = await deleteInvoiceAction(invoice.id)
      if (!res.success) setError(res.error ?? 'Failed')
      else router.push('/invoices')
    })
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleCopyPrompt() {
    if (!promptText) return
    navigator.clipboard.writeText(promptText).then(() => {
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2000)
    })
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Status actions */}
      <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoice Actions</p>

        {!isPaid && invoice.status === 'draft' && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            disabled={isPending}
            onClick={() => handleStatus('sent')}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Mark as Sent
          </Button>
        )}

        {!isPaid && invoice.status === 'sent' && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            disabled={isPending}
            onClick={() => handleStatus('draft')}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Revert to Draft
          </Button>
        )}

        {!isPaid && (invoice.status === 'sent' || invoice.status === 'overdue') && (
          <Button
            className="w-full justify-start gap-2"
            disabled={isPending}
            onClick={handleMarkPaid}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Mark as Paid
          </Button>
        )}

        {isPaid && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
            <Check className="size-4 shrink-0" />
            Paid — transaction recorded
          </div>
        )}
      </div>

      {/* Share / Export */}
      <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Share &amp; Export</p>

        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleCopyLink}
        >
          {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {copied ? 'Link copied!' : 'Copy client link'}
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2 print:hidden"
          onClick={handlePrint}
        >
          <Printer className="size-4" />
          Print / Save as PDF
        </Button>
      </div>

      {/* AI Prompt */}
      {promptText && (
        <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Cover Email</p>
          <p className="text-xs text-muted-foreground">
            Copy this prompt into ChatGPT or Claude to draft the sending email.
          </p>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleCopyPrompt}
          >
            {promptCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {promptCopied ? 'Copied!' : 'Copy prompt'}
          </Button>
        </div>
      )}

      {/* Danger zone */}
      {!isPaid && (
        <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Danger Zone</p>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Delete Invoice
          </Button>
        </div>
      )}
    </div>
  )
}
