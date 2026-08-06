import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Archive } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { listInvoices } from '@/lib/invoices'
import { InvoiceList } from '@/components/invoices/invoice-list'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SearchParams = Promise<{ archived?: string }>

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const params = await searchParams
  const archived = params.archived === 'true'

  const invoices = await listInvoices(ownerId, { archived })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {archived
              ? 'Archived invoices — restore one to put it back in the working list'
              : 'Create, send, and track your invoices'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={archived ? '/invoices' : '/invoices?archived=true'}
            aria-pressed={archived}
            className={cn(
              buttonVariants({ variant: archived ? 'secondary' : 'outline' }),
              'gap-1.5',
            )}
          >
            <Archive className="size-4" />
            {archived ? 'Active' : 'Archived'}
          </Link>
          {!archived && (
            <Link href="/invoices/new" className={cn(buttonVariants(), 'gap-1.5')}>
              <Plus className="size-4" />
              New Invoice
            </Link>
          )}
        </div>
      </div>

      <InvoiceList invoices={invoices} isArchivedView={archived} />
    </div>
  )
}
