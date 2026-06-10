'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2, AlertCircle, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createFormAction, updateFormAction } from '@/lib/actions/forms'
import type { FormField, FormFieldType, SerializedForm } from '@/lib/forms'
import { randomUUID } from '@/lib/client-uuid'

// ── Types ─────────────────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text:     'Short text',
  textarea: 'Long text',
  email:    'Email',
  phone:    'Phone',
  number:   'Number',
  select:   'Dropdown',
  checkbox: 'Checkbox (yes/no)',
}

interface FormBuilderProps {
  projectId: string
  projects: { id: string; title: string; clientName: string }[]
  existing?: SerializedForm
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FormBuilder({ projectId, projects, existing }: FormBuilderProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle]           = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [selectedProjectId, setSelectedProjectId] = useState(existing?.projectId ?? projectId)
  const [fields, setFields]         = useState<FormField[]>(existing?.fields ?? [])
  const [error, setError]           = useState<string | null>(null)

  function addField() {
    const newField: FormField = {
      id:       randomUUID(),
      label:    '',
      type:     'text',
      required: false,
      order:    fields.length,
    }
    setFields((prev) => [...prev, newField])
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, order: i })))
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function moveField(id: string, dir: -1 | 1) {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next.map((f, i) => ({ ...f, order: i }))
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    for (const f of fields) {
      if (!f.label.trim()) { setError('All fields must have a label'); return }
      if (f.type === 'select' && (!f.options || f.options.length < 2)) {
        setError(`Dropdown "${f.label}" needs at least 2 options`); return
      }
    }

    startTransition(async () => {
      const payload = { projectId: selectedProjectId, title, description: description || null, fields }
      const result = existing
        ? await updateFormAction(existing.id, payload)
        : await createFormAction(payload)

      if ('error' in result) { setError(result.error ?? 'Something went wrong'); return }
      const formId = 'form' in result ? result.form.id : existing!.id
      router.push(`/forms/${formId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Meta ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Form details</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="form-title">Title</label>
          <input
            id="form-title"
            type="text"
            required
            maxLength={200}
            placeholder="e.g. Project intake questionnaire"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="form-description">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
          <textarea
            id="form-description"
            rows={2}
            maxLength={1000}
            placeholder="Brief instructions shown to the client at the top of the form"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="form-project">Project</label>
          <select
            id="form-project"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.clientName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Fields ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Fields</h2>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="size-3.5" />
            Add field
          </Button>
        </div>

        {fields.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">No fields yet. Add one above.</p>
          </div>
        )}

        {fields.map((field, idx) => (
          <FieldEditor
            key={field.id}
            field={field}
            index={idx}
            total={fields.length}
            onChange={(patch) => updateField(field.id, patch)}
            onRemove={() => removeField(field.id)}
            onMove={(dir) => moveField(field.id, dir)}
          />
        ))}
      </div>

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !title.trim()}>
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          {existing ? 'Save changes' : 'Create form'}
        </Button>
      </div>
    </form>
  )
}

// ── FieldEditor ───────────────────────────────────────────────────────────────

interface FieldEditorProps {
  field:    FormField
  index:    number
  total:    number
  onChange: (patch: Partial<FormField>) => void
  onRemove: () => void
  onMove:   (dir: -1 | 1) => void
}

function FieldEditor({ field, index, total, onChange, onRemove, onMove }: FieldEditorProps) {
  const [optionsText, setOptionsText] = useState(field.options?.join('\n') ?? '')

  function handleOptionsChange(val: string) {
    setOptionsText(val)
    const opts = val.split('\n').map((s) => s.trim()).filter(Boolean)
    onChange({ options: opts })
  }

  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col items-center gap-1 pt-1 text-muted-foreground/40">
        <GripVertical className="size-4" />
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Label</label>
            <input
              type="text"
              placeholder="Question or label"
              value={field.label}
              onChange={(e) => onChange({ label: e.target.value })}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <select
              value={field.type}
              onChange={(e) => onChange({ type: e.target.value as FormFieldType })}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {(Object.keys(FIELD_TYPE_LABELS) as FormFieldType[]).map((t) => (
                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Required</label>
            <div className="flex h-8 items-center">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onChange({ required: e.target.checked })}
                className="h-4 w-4 rounded border-input accent-primary"
              />
            </div>
          </div>
        </div>

        {field.type === 'select' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Options <span className="font-normal">(one per line)</span>
            </label>
            <textarea
              rows={3}
              placeholder={"Option A\nOption B\nOption C"}
              value={optionsText}
              onChange={(e) => handleOptionsChange(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label="Move field up"
          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label="Move field down"
          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <ChevronDown className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove field"
          className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
