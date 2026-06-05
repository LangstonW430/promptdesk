import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { listInvoices } from '@/lib/invoices'
import { InvoiceList } from '@/components/invoices/invoice-list'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function InvoicesPage() {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const invoices = await listInvoices(ownerId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, send, and track your invoices
          </p>
        </div>
        <Link href="/invoices/new" className={cn(buttonVariants(), 'gap-1.5')}>
          <Plus className="size-4" />
          New Invoice
        </Link>
      </div>

      <InvoiceList invoices={invoices} />
    </div>
  )
}
