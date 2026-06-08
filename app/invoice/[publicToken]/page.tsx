import { notFound } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { getInvoiceByPublicToken } from '@/lib/invoices'
import { getStripeKeyStatus } from '@/lib/finance/stripe-key'
import { InvoiceView } from '@/components/invoices/invoice-view'
import { PublicPayButton } from '@/components/invoices/public-pay-button'
import { PrintButton } from '@/components/invoices/print-button'

export const dynamic = 'force-dynamic'

export default async function PublicInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ publicToken: string }>
  searchParams: Promise<{ paid?: string }>
}) {
  const { publicToken } = await params
  const { paid } = await searchParams

  const invoice = await getInvoiceByPublicToken(publicToken)
  if (!invoice) notFound()

  const { connected: stripeEnabled } = await getStripeKeyStatus(invoice.ownerId)
  const canPay =
    stripeEnabled &&
    (invoice.status === 'sent' || invoice.status === 'overdue')

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Payment success banner — shown after Stripe redirects back */}
        {paid === '1' && (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-4 py-3 text-green-700 dark:text-green-400 print:hidden">
            <CheckCircle2 className="size-5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Payment received — thank you!</p>
              <p className="text-xs opacity-80 mt-0.5">
                Your payment is being processed. The invoice status will update shortly.
              </p>
            </div>
          </div>
        )}

        <InvoiceView invoice={invoice} showFrom />

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
          <PrintButton />

          {canPay && invoice.status !== 'paid' && (
            <PublicPayButton publicToken={publicToken} total={invoice.total} />
          )}
        </div>

        {invoice.status === 'paid' && (
          <p className="text-center text-sm text-muted-foreground print:hidden">
            This invoice has been paid.
          </p>
        )}
      </div>
    </div>
  )
}
