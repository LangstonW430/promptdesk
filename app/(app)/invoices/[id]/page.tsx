import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth'
import { getInvoice } from '@/lib/invoices'
import { prisma } from '@/lib/db/client'
import { renderTemplate } from '@/lib/prompt-engine'
import { invoiceCoverEmail } from '@/lib/prompt-engine/templates/invoice-cover-email'
import { InvoiceView } from '@/components/invoices/invoice-view'
import { InvoiceActions } from '@/components/invoices/invoice-actions'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { id } = await params
  const [invoice, user] = await Promise.all([
    getInvoice(ownerId, id),
    getCurrentUser(),
  ])

  if (!invoice) notFound()

  // Fetch owner settings for prompt rendering
  const ownerRow = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      businessName: true,
      businessType: true,
      businessAddress: true,
      taxNumber: true,
    },
  })

  // What the client will find missing when they open the link. Checked here
  // rather than at send time so it is visible while there is still something
  // to do about it.
  const missingDetails: string[] = []
  if (!ownerRow?.businessName) missingDetails.push('your business name')
  if (!ownerRow?.businessAddress) missingDetails.push('your business address')
  if (!ownerRow?.taxNumber) missingDetails.push('your tax number')
  if (!invoice.clientAddress) missingDetails.push("the client's billing address")

  // Build invoice cover email prompt
  const lineSummary = invoice.lineItems
    .map((li) => `${li.description} (×${li.quantity} @ ${formatCurrency(li.unitPrice)})`)
    .join('; ')

  const promptResult = renderTemplate(invoiceCoverEmail, {
    businessName: ownerRow?.businessName ?? user?.email ?? '',
    businessType: ownerRow?.businessType ?? '',
    today: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    contextBlock: '',
    extras: {
      // A draft has no number from Stripe yet, and the cover email is usually
      // drafted before sending — so the prompt says so rather than printing an
      // empty reference the client would be asked to quote.
      invoice_number: invoice.number ?? 'the attached invoice',
      client_name: invoice.clientName,
      invoice_total: formatCurrency(invoice.total),
      due_date: new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      line_items_summary: lineSummary,
      // Empty until Stripe has finalized the invoice and issued its hosted
      // page. The template is told to say nothing about payment rather than
      // invent a method when this is blank.
      payment_link: invoice.hostedInvoiceUrl ?? '',
    },
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/invoices"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Invoices
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Invoice preview */}
        <div className="print:block">
          <InvoiceView invoice={invoice} />
        </div>

        {/* Actions sidebar — hidden when printing */}
        <div className="print:hidden">
          <InvoiceActions
            invoice={invoice}
            missingDetails={missingDetails}
            clientId={invoice.clientId}
            promptText={promptResult.text}
          />
        </div>
      </div>
    </div>
  )
}
