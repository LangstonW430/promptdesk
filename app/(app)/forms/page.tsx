import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, ClipboardList } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { listForms } from '@/lib/forms'
import { buttonVariants } from '@/components/ui/button'
import { FormStatusBadge } from '@/components/forms/form-status-badge'

export const dynamic = 'force-dynamic'

export default async function FormsPage() {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const forms = await listForms(ownerId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create shareable intake forms for your clients.
          </p>
        </div>
        <Link href="/forms/new" className={buttonVariants({ size: 'sm' })}>
          <Plus className="size-3.5" />
          New form
        </Link>
      </div>

      {forms.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">No forms yet</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create a form to share with a client and collect their information.
            </p>
          </div>
          <Link href="/forms/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Plus className="size-3.5" />
            Create first form
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center border-b border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
            <span>Form</span>
            <span className="w-28 text-center">Status</span>
            <span className="w-24 text-center">Responses</span>
            <span className="w-16" />
          </div>
          <ul>
            {forms.map((form, idx) => (
              <li
                key={form.id}
                className={[
                  'grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors',
                  idx !== forms.length - 1 ? 'border-b border-border/40' : '',
                ].join(' ')}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <Link
                    href={`/forms/${form.id}`}
                    className="text-sm font-medium hover:underline truncate"
                  >
                    {form.title}
                  </Link>
                  <span className="text-xs text-muted-foreground truncate">
                    {form.projectTitle} · {form.clientName}
                  </span>
                </div>
                <div className="w-28 flex justify-center">
                  <FormStatusBadge isActive={form.isActive} />
                </div>
                <div className="w-24 text-center text-sm tabular-nums text-muted-foreground">
                  {form.submissionCount}
                </div>
                <div className="w-16 flex justify-end">
                  <Link
                    href={`/forms/${form.id}`}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
