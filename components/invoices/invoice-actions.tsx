'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Send,
  Link2,
  Loader2,
  Trash2,
  AlertCircle,
  Copy,
  Info,
  RefreshCw,
  ExternalLink,
  FileDown,
  Archive,
  Bell,
  Banknote,
  FileX,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  sendInvoiceAction,
  refreshInvoiceAction,
  deleteInvoiceAction,
  remindInvoiceAction,
  markInvoicePaidOutOfBandAction,
  writeOffInvoiceAction,
} from '@/lib/actions/invoices'
import { ClientLinkPicker, type ClientOption } from './client-link-picker'
import type { SerializedInvoice } from '@/lib/invoices/types'

/** "a, b and c" — a list a person would read aloud. */
function formatList(items: string[]): string {
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

type Props = {
  invoice: SerializedInvoice
  promptText: string | null
  /**
   * Billing details a client would find missing on the invoice, phrased as a
   * list of things to add. Empty when the invoice is complete.
   */
  missingDetails: string[]
  /** Null for an imported invoice that matched no CRM client. */
  clientId: string | null
  /** Offered when the invoice is unattributed, so it can be linked by hand. */
  clients: ClientOption[]
}

export function InvoiceActions({
  invoice,
  promptText,
  missingDetails,
  clientId,
  clients,
}: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)

  const isDraft = invoice.status === 'draft'
  const isOpen = invoice.status === 'open'
  const isPaid = invoice.status === 'paid'
  const isClosed = invoice.status === 'void' || invoice.status === 'uncollectible'

  /** Runs a one-argument invoice action and reports the outcome. */
  function run(
    action: (id: string) => Promise<{ success: boolean; error?: string }>,
    successNotice: string,
  ) {
    setError(null)
    setNotice(null)
    start(async () => {
      const res = await action(invoice.id)
      if (!res.success) {
        setError(res.error ?? 'Failed')
        return
      }
      setNotice(successNotice)
      router.refresh()
    })
  }

  /** Same, behind a confirmation — for the ones that change what a client owes. */
  function confirmThen(
    message: string,
    action: (id: string) => Promise<{ success: boolean; error?: string }>,
    successNotice: string,
  ) {
    if (!confirm(message)) return
    run(action, successNotice)
  }

  async function handleSend() {
    setError(null)
    setNotice(null)
    start(async () => {
      const res = await sendInvoiceAction(invoice.id)
      if (!res.success) setError(res.error ?? 'Failed')
      else router.refresh()
    })
  }

  async function handleRefresh() {
    setError(null)
    setNotice(null)
    start(async () => {
      const res = await refreshInvoiceAction(invoice.id)
      if (!res.success) setError(res.error ?? 'Failed')
      else router.refresh()
    })
  }

  async function handleDelete() {
    const message = isDraft
      ? 'Delete this draft? It will be removed from Stripe too.'
      : 'This invoice has been sent, so it cannot be deleted. It will be voided ' +
        'in Stripe instead — the client can no longer pay it, and it stays on ' +
        'record. Continue?'
    if (!confirm(message)) return

    setError(null)
    setNotice(null)
    start(async () => {
      const res = await deleteInvoiceAction(invoice.id)
      if (!res.success) {
        setError(res.error ?? 'Failed')
        return
      }
      if (res.outcome === 'voided') {
        // Stays on the detail page: the invoice still exists, now marked void,
        // and sending the user to the list would suggest it had been removed.
        setNotice('Invoice voided. It stays on record and can no longer be paid.')
        router.refresh()
        return
      }
      router.push('/invoices')
    })
  }

  function handleCopyLink() {
    if (!invoice.hostedInvoiceUrl) return
    navigator.clipboard.writeText(invoice.hostedInvoiceUrl).then(() => {
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

  // A legacy invoice has no Stripe record behind it, so none of the actions
  // that talk to Stripe apply. It is a document to read, and to delete.
  if (invoice.isLegacy) {
    return (
      <div className="flex flex-col gap-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold">Raised before Stripe billing</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              This invoice was created by the old system, so it has no Stripe
              record and cannot be sent or paid through the app. It is kept here
              as a record. To bill this work through Stripe, raise a new invoice.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Danger Zone
          </p>
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
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" />
          {notice}
        </div>
      )}

      {/* Missing billing details — shown while there is still time to fix it */}
      {missingDetails.length > 0 && isDraft && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              This invoice is missing {missingDetails.length === 1 ? 'a detail' : 'details'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
              Your client will not see {formatList(missingDetails)}. Most
              jurisdictions require both parties&rsquo; addresses on a valid invoice,
              and their bookkeeper will ask for your tax number.
            </p>
            <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
              <Link href="/settings" className="underline underline-offset-2">Settings</Link>
              {/* No client to edit on an imported invoice that matched none. */}
              {clientId && (
                <>
                  {' · '}
                  <Link
                    href={`/clients/${clientId}/edit`}
                    className="underline underline-offset-2"
                  >
                    Edit client
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Draft callout — explains what sending actually does */}
      {isDraft && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
          <Info className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              This invoice is a draft
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              <strong>Send</strong> finalizes it in Stripe, assigns its number and
              emails it to your client with a link to pay. A finalized invoice
              can no longer be edited, only voided.
            </p>
          </div>
        </div>
      )}

      {/* Status actions */}
      <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Invoice Actions
        </p>

        {isDraft && (
          <Button
            className="w-full justify-start gap-2"
            disabled={isPending}
            onClick={handleSend}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send via Stripe
          </Button>
        )}

        {isPaid && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
            <Check className="size-4 shrink-0" />
            Paid — transaction recorded
          </div>
        )}

        {isClosed && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Archive className="size-4 shrink-0" />
            {invoice.status === 'void'
              ? 'Voided — this invoice can no longer be paid.'
              : 'Written off as uncollectible.'}
          </div>
        )}

        {/* Everything you would reach for on an unpaid, already-sent invoice. */}
        {isOpen && (
          <>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              disabled={isPending}
              onClick={() => run(remindInvoiceAction, 'Reminder sent.')}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
              Send reminder
            </Button>
            <p className="-mt-1 text-xs text-muted-foreground leading-relaxed">
              Re-sends the invoice email. Stripe&apos;s reminder is the same message
              it delivered originally.
            </p>

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              disabled={isPending}
              onClick={() =>
                confirmThen(
                  'Mark this invoice paid? Use this only when the money arrived ' +
                    'outside Stripe — a bank transfer or cheque. Stripe will not ' +
                    'try to charge the client.',
                  markInvoicePaidOutOfBandAction,
                  'Marked paid.',
                )
              }
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
              Mark paid (outside Stripe)
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              disabled={isPending}
              onClick={() =>
                confirmThen(
                  'Write this invoice off as uncollectible? It stays on record as ' +
                    'issued but unpaid. Use void instead if it should never have ' +
                    'been sent.',
                  writeOffInvoiceAction,
                  'Written off as uncollectible.',
                )
              }
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <FileX className="size-4" />}
              Write off as uncollectible
            </Button>
          </>
        )}

        {!isDraft && (
          <>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              disabled={isPending}
              onClick={handleRefresh}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh from Stripe
            </Button>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Payments normally update on their own. Use this if you changed the
              invoice in Stripe, or to check its status now.
            </p>
          </>
        )}
      </div>

      {/* Client linking — only worth showing when nothing is attached */}
      {!invoice.clientId && (
        <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Not linked to a client
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {invoice.clientEmail
              ? `This invoice was imported from Stripe and billed to ${invoice.clientEmail}, which does not match any client in your CRM.`
              : 'This invoice was imported from Stripe and has no billing email to match on.'}{' '}
            Linking it files its payment against that client and their projects.
          </p>
          <ClientLinkPicker invoiceId={invoice.id} clients={clients} />
        </div>
      )}

      {/* Share / Export — all of it Stripe's, now */}
      {!isDraft && (
        <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Share &amp; Export
          </p>

          <div className="flex flex-col gap-1.5">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleCopyLink}
              disabled={!invoice.hostedInvoiceUrl}
            >
              {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
              {copied ? 'Link copied!' : 'Copy payment link'}
            </Button>
            <p className="text-xs text-muted-foreground/70 leading-relaxed pl-0.5">
              Stripe already emailed this to your client. The same link works if
              you want to send it again yourself.
            </p>
          </div>

          {/* Anchors rather than Buttons: this Button has no `asChild`, and
              both destinations are Stripe's own pages. */}
          {invoice.hostedInvoiceUrl && (
            <a
              href={invoice.hostedInvoiceUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'w-full justify-start gap-2',
              )}
            >
              <ExternalLink className="size-4" />
              View as your client sees it
            </a>
          )}

          {invoice.invoicePdf && (
            <a
              href={invoice.invoicePdf}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'w-full justify-start gap-2',
              )}
            >
              <FileDown className="size-4" />
              Download PDF
            </a>
          )}
        </div>
      )}

      {/* AI Prompt */}
      {promptText && (
        <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            AI Cover Email
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Paste this prompt into ChatGPT or Claude to draft a professional cover
            email for this invoice.
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
      {!isPaid && !isClosed && (
        <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Danger Zone
          </p>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {isDraft ? 'Delete draft' : 'Void invoice'}
          </Button>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isDraft
              ? 'Removes the draft from Stripe as well.'
              : 'A sent invoice cannot be deleted. Voiding stops it being payable and leaves it on record.'}
          </p>
        </div>
      )}
    </div>
  )
}
