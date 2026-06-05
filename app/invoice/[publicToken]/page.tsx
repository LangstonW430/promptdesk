import { notFound } from 'next/navigation'
import { getInvoiceByPublicToken } from '@/lib/invoices'
import { InvoiceView } from '@/components/invoices/invoice-view'

export const dynamic = 'force-dynamic'

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ publicToken: string }>
}) {
  const { publicToken } = await params
  const invoice = await getInvoiceByPublicToken(publicToken)

  if (!invoice) notFound()

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <InvoiceView invoice={invoice} showFrom />

        {/* Print button — hidden when actually printing */}
        <div className="mt-6 flex justify-center print:hidden">
          <button
            onClick={() => typeof window !== 'undefined' && window.print()}
            suppressHydrationWarning
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  )
}
