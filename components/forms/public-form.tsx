'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PublicFormData, FormField } from '@/lib/forms'

interface PublicFormProps {
  form: PublicFormData
  publicToken: string
}

export function PublicForm({ form, publicToken }: PublicFormProps) {
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(form.fields.map((f) => [f.id, f.type === 'checkbox' ? false : ''])),
  )
  const [submitterName, setSubmitterName]   = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')

  function setAnswer(fieldId: string, value: string | boolean) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/public/forms/${publicToken}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submitterName:  submitterName.trim() || undefined,
          submitterEmail: submitterEmail.trim() || undefined,
          answers,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Something went wrong')
        return
      }
      setSubmitted(true)
    })
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="size-12 text-green-500" />
        <div>
          <h2 className="text-xl font-semibold">Thank you!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your response has been submitted successfully.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Submitter info */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-muted-foreground">Your information <span className="font-normal">(optional)</span></h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="submitter-name">Name</label>
            <input
              id="submitter-name"
              type="text"
              maxLength={200}
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              placeholder="Your name"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="submitter-email">Email</label>
            <input
              id="submitter-email"
              type="email"
              maxLength={300}
              value={submitterEmail}
              onChange={(e) => setSubmitterEmail(e.target.value)}
              placeholder="your@email.com"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-5">
        {form.fields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            value={answers[field.id]}
            onChange={(v) => setAnswer(field.id, v)}
          />
        ))}
      </div>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto sm:self-end">
        {isPending && <Loader2 className="size-3.5 animate-spin" />}
        Submit
      </Button>
    </form>
  )
}

// ── Field input renderers ─────────────────────────────────────────────────────

interface FieldInputProps {
  field:    FormField
  value:    string | boolean | undefined
  onChange: (v: string | boolean) => void
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const inputClass =
    'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
  const label = (
    <label className="text-sm font-medium" htmlFor={`field-${field.id}`}>
      {field.label}
      {field.required && <span className="ml-1 text-destructive">*</span>}
    </label>
  )

  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center gap-3">
        <input
          id={`field-${field.id}`}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          required={field.required}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <label className="text-sm font-medium" htmlFor={`field-${field.id}`}>
          {field.label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </label>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <textarea
          id={`field-${field.id}`}
          rows={4}
          required={field.required}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <select
          id={`field-${field.id}`}
          required={field.required}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">Select an option…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label}
      <input
        id={`field-${field.id}`}
        type={field.type === 'phone' ? 'tel' : field.type}
        required={field.required}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  )
}
