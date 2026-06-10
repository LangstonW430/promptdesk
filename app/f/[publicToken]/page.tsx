import { notFound } from 'next/navigation'
import { getFormByPublicToken } from '@/lib/forms'
import { PublicForm } from '@/components/forms/public-form'

export const dynamic = 'force-dynamic'

type Params = Promise<{ publicToken: string }>

export default async function PublicFormPage({ params }: { params: Params }) {
  const { publicToken } = await params
  const form = await getFormByPublicToken(publicToken)
  if (!form) notFound()

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="mx-auto max-w-xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1.5">
          {form.ownerBusinessName && (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {form.ownerBusinessName}
            </p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{form.title}</h1>
          {form.description && (
            <p className="text-sm text-muted-foreground">{form.description}</p>
          )}
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <PublicForm form={form} publicToken={publicToken} />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Powered by PromptDesk
        </p>
      </div>
    </div>
  )
}
