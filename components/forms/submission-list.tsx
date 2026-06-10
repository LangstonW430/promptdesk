'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Inbox } from 'lucide-react'
import type { FormField, FormSubmissionRow } from '@/lib/forms'

interface SubmissionListProps {
  submissions: FormSubmissionRow[]
  fields: FormField[]
}

export function SubmissionList({ submissions, fields }: SubmissionListProps) {
  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Inbox className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No submissions yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {submissions.map((s) => (
        <SubmissionRow key={s.id} submission={s} fields={fields} />
      ))}
    </div>
  )
}

function SubmissionRow({ submission, fields }: { submission: FormSubmissionRow; fields: FormField[] }) {
  const [open, setOpen] = useState(false)

  const submittedAt = new Date(submission.submittedAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  const label = submission.submitterName ?? submission.submitterEmail ?? 'Anonymous'

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {open
          ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
        <span className="flex-1 text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{submittedAt}</span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          {submission.submitterEmail && (
            <div className="mb-4 flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</span>
              <span className="text-sm">{submission.submitterEmail}</span>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {fields.map((field) => {
              const val = submission.answers[field.id]
              const display = formatValue(val, field)
              return (
                <div key={field.id} className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {field.label}
                  </span>
                  <span className="text-sm whitespace-pre-wrap">
                    {display ?? <span className="italic text-muted-foreground">—</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function formatValue(val: unknown, field: FormField): string | null {
  if (val === undefined || val === null || val === '') return null
  if (field.type === 'checkbox') return val ? 'Yes' : 'No'
  return String(val)
}
