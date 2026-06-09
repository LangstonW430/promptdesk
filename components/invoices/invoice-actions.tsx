'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Send, Link2, Printer, Loader2, Trash2, AlertCircle, Copy, FileText, Info } from 'lucide-react'
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
  const isDraft = invoice.status === 'draft'

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

      {/* Draft callout — explains the required next step */}
      {isDraft && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
          <Info className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">This invoice is a draft</p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Click <strong>Mark as Sent</strong> below to activate the client link and enable online payment.
            </p>
          </div>
        </div>
      )}

      {/* Status actions */}
      <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoice Actions</p>

        {!isPaid && isDraft && (
          <Button
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
          <>
            <Button
              className="w-full justify-start gap-2"
              disabled={isPending}
              onClick={handleMarkPaid}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Mark as Paid
            </Button>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Or share the client link below — if you&apos;ve connected Stripe, your client can pay by card directly.
            </p>
          </>
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

        <div className="flex flex-col gap-1.5">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleCopyLink}
            disabled={isDraft}
            title={isDraft ? 'Mark invoice as sent before sharing' : undefined}
          >
            {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            {copied ? 'Link copied!' : 'Copy client link'}
          </Button>
          {isDraft ? (
            <p className="text-xs text-muted-foreground/70 leading-relaxed pl-0.5">
              Mark as Sent first to activate the shareable link.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/70 leading-relaxed pl-0.5">
              Send this to your client. They can view the invoice, download a PDF, and pay online.
            </p>
          )}
        </div>

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
          <p className="text-xs text-muted-foreground leading-relaxed">
            Paste this prompt into ChatGPT or Claude to draft a professional cover email for this invoice.
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
