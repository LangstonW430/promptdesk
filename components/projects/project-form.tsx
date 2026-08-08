'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createProjectAction, updateProjectAction } from '@/lib/actions/projects'

interface Client {
  id: string
  displayName: string
}

interface ProjectFormProps {
  clients:     Client[]
  defaultClientId?: string
  project?: {
    id:           string
    title:        string
    clientId:     string
    status:       string
    startDate:    string | null
    endDate:      string | null
    budget:       number | null
    rate:         number | null
    deliverables: string[]
  }
}

const STATUS_OPTIONS = [
  { value: 'proposed',  label: 'Proposed' },
  { value: 'active',    label: 'Active' },
  { value: 'on_hold',   label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function ProjectForm({ clients, defaultClientId, project }: ProjectFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    clientId:    project?.clientId     ?? defaultClientId ?? '',
    title:       project?.title        ?? '',
    status:      project?.status       ?? 'active',
    startDate:   project?.startDate    ?? '',
    endDate:     project?.endDate      ?? '',
    budget:      project?.budget != null ? String(project.budget) : '',
    rate:        project?.rate   != null ? String(project.rate)   : '',
    deliverables: (project?.deliverables ?? []).join('\n'),
  })

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const deliverables = form.deliverables
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    const payload = {
      clientId:     form.clientId,
      title:        form.title.trim(),
      status:       form.status,
      startDate:    form.startDate || null,
      endDate:      form.endDate   || null,
      budget:       form.budget !== '' ? Number(form.budget) : null,
      rate:         form.rate   !== '' ? Number(form.rate)   : null,
      deliverables,
    }

    startTransition(async () => {
      const result = project
        ? await updateProjectAction(project.id, payload)
        : await createProjectAction(payload)

      if ('error' in result) {
        setError(result.error ?? 'Something went wrong')
        return
      }

      const projectId = 'project' in result ? result.project.id : project!.id
      router.push(`/projects/${projectId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Project title <span className="text-destructive">*</span></label>
        <input
          type="text"
          required
          placeholder="e.g. Website redesign"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          disabled={isPending}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        />
      </div>

      {/* Client */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Client <span className="text-destructive">*</span></label>
        <select
          required
          value={form.clientId}
          onChange={(e) => set('clientId', e.target.value)}
          disabled={isPending || !!defaultClientId}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.displayName}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Status</label>
        <select
          value={form.status}
          onChange={(e) => set('status', e.target.value)}
          disabled={isPending}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Start date</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            disabled={isPending}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">End date</label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => set('endDate', e.target.value)}
            disabled={isPending}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Budget and rate */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Budget ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="—"
            value={form.budget}
            onChange={(e) => set('budget', e.target.value)}
            disabled={isPending}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Hourly rate ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={project ? '—' : "Client's rate"}
            value={form.rate}
            onChange={(e) => set('rate', e.target.value)}
            disabled={isPending}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">
            Fills in new time entries. Left blank on a new project, the
            client&rsquo;s rate is used.
          </p>
        </div>
      </div>

      {/* Deliverables */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Deliverables <span className="text-xs font-normal text-muted-foreground">(one per line)</span></label>
        <textarea
          rows={4}
          placeholder="Design mockups&#10;Frontend build&#10;QA &amp; launch"
          value={form.deliverables}
          onChange={(e) => set('deliverables', e.target.value)}
          disabled={isPending}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !form.title.trim() || !form.clientId}>
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          {project ? 'Save changes' : 'Create project'}
        </Button>
      </div>
    </form>
  )
}
