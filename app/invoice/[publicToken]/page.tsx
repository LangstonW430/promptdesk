import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getInvoiceByPublicToken } from '@/lib/invoices'
import { InvoiceView } from '@/components/invoices/invoice-view'
import { PrintButton } from '@/components/invoices/print-button'

export const dynamic = 'force-dynamic'

/**
 * An invoice link is unguessable but not secret — clients forward them, and
 * link-preview bots follow them. Nothing here should end up in a search index:
 * it carries a client's name, what they were billed for and what they owe.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

/**
 * The public page for a legacy invoice.
 *
 * Invoices raised since the move to Stripe are hosted by Stripe, at the URL in
 * `hostedInvoiceUrl`, and never had a token here. This page exists for the ones
 * sent before that: their links are already in clients' inboxes, and deleting
 * the route would 404 documents people were asked to pay.
 *
 * Read-only. Card payment ran through a Checkout session created by
 * /api/invoice/[token]/checkout, which is gone — Stripe collects payment on its
 * own hosted page now. Anyone still needing to settle one of these should be
 * billed again through Stripe.
 */
export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ publicToken: string }>
}) {
  const { publicToken } = await params

  const invoice = await getInvoiceByPublicToken(publicToken)
  if (!invoice) notFound()

  // A draft is an unfinished document, and its link was never live.
  if (invoice.status === 'draft') notFound()

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl space-y-6">
        <InvoiceView invoice={invoice} showFrom />

        <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
          <PrintButton />
        </div>

        {invoice.status === 'paid' ? (
          <p className="text-center text-sm text-muted-foreground print:hidden">
            This invoice has been paid.
          </p>
        ) : (
          <p className="mx-auto max-w-md text-center text-sm text-muted-foreground print:hidden">
            To pay this invoice, please contact{' '}
            {invoice.ownerBusinessName ?? invoice.ownerEmail} for a payment link.
          </p>
        )}
      </div>
    </div>
  )
}
