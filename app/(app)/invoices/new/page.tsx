import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/auth'
import { fetchClientsForPicker, fetchBillableEntries } from '@/lib/invoices'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import type { LineItem } from '@/lib/invoices/types'
import { prisma } from '@/lib/db/client'

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ entries?: string }>
}) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { entries: entriesParam } = await searchParams
  const [clients, user] = await Promise.all([
    fetchClientsForPicker(ownerId),
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { defaultPaymentTerms: true },
    }),
  ])

  let prefill: { entryIds: string[]; clientId: string; lineItems: LineItem[] } | undefined

  if (entriesParam) {
    const entryIds = entriesParam.split(',').filter((id) => /^[0-9a-f-]{36}$/.test(id))
    if (entryIds.length > 0) {
      const entries = await fetchBillableEntries(ownerId, entryIds)
      if (entries.length > 0) {
        const clientId = entries[0].project.client.id
        const lineItems: LineItem[] = entries.map((e) => {
          const h = typeof e.hours === 'object' ? e.hours.toNumber() : Number(e.hours)
          const r = e.rate != null
            ? (typeof e.rate === 'object' ? e.rate.toNumber() : Number(e.rate))
            : 0
          const dateStr =
            e.date instanceof Date
              ? e.date.toISOString().slice(0, 10)
              : String(e.date).slice(0, 10)
          return {
            id: e.id,
            description: e.description ? `${dateStr}: ${e.description}` : dateStr,
            quantity: h,
            unitPrice: r,
            amount: Math.round(h * r * 100) / 100,
          }
        })
        prefill = { entryIds: entries.map((e) => e.id), clientId, lineItems }
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {prefill ? 'Invoice from Time Entries' : 'New Invoice'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {prefill
            ? 'Review the line items rolled up from your time entries.'
            : 'Add line items manually or convert time entries from the Time page.'}
        </p>
      </div>

      <InvoiceForm
        clients={clients}
        defaultTerms={user?.defaultPaymentTerms ?? null}
        prefill={prefill}
      />
    </div>
  )
}
