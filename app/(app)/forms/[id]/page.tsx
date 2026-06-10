import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft, Pencil } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { getFormById, listFormSubmissions } from '@/lib/forms'
import { buttonVariants } from '@/components/ui/button'
import { ShareLink } from '@/components/forms/share-link'
import { SubmissionList } from '@/components/forms/submission-list'
import { FormStatusBadge } from '@/components/forms/form-status-badge'
import { FormActions } from '@/components/forms/form-actions'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function FormDetailPage({ params }: { params: Params }) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { id } = await params
  let form
  try {
    form = await getFormById(ownerId, id)
  } catch {
    notFound()
  }

  const submissions = await listFormSubmissions(ownerId, id)

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6">
      <Link
        href="/forms"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to forms
      </Link>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight truncate">{form.title}</h1>
            <FormStatusBadge isActive={form.isActive} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href={`/projects/${form.projectId}`} className="hover:text-foreground transition-colors">
              {form.projectTitle}
            </Link>
            <span>·</span>
            <span>{form.clientName}</span>
          </div>
          {form.description && (
            <p className="text-sm text-muted-foreground mt-1">{form.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/forms/${id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Pencil className="size-3.5" />
            Edit
          </Link>
          <FormActions formId={id} isActive={form.isActive} />
        </div>
      </div>

      {/* ── Share link ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <ShareLink publicToken={form.publicToken} />
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <span className="text-xs text-muted-foreground">Responses</span>
          <span className="text-2xl font-semibold tabular-nums">{submissions.length}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <span className="text-xs text-muted-foreground">Fields</span>
          <span className="text-2xl font-semibold tabular-nums">{form.fields.length}</span>
        </div>
      </div>

      {/* ── Submissions ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Responses
        </h2>
        <SubmissionList submissions={submissions} fields={form.fields} />
      </div>
    </div>
  )
}
