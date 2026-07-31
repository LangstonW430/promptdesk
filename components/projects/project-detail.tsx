'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckSquare, Square, Pencil, Trash2, Plus, Loader2, DollarSign, CalendarDays, AlertCircle, Archive, ArchiveRestore } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { ProjectStatusBadge } from './project-status-badge'
import { TimerWidget } from '@/components/time-tracking/timer-widget'
import { updateProjectAction, deleteProjectAction, setProjectArchivedAction } from '@/lib/actions/projects'
import { deleteTimeEntryAction } from '@/lib/actions/time-entries'
import type { SerializedTimeEntry } from '@/lib/time-entries/serialize'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectTask {
  id:       string
  title:    string
  isDone:   boolean
  dueDate:  string | null
}

interface ProjectDetailProps {
  project: {
    id:           string
    title:        string
    status:       string
    startDate:    string | null
    endDate:      string | null
    budget:       number | null
    deliverables: string[]
    clientId:     string
    clientName:   string
    defaultRate:  number | null
    isArchived:   boolean
    tasks:        ProjectTask[]
  }
  timeEntries: SerializedTimeEntry[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string | null {
  if (!d) return null
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatHours(h: number): string {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount)
}

function formatEntryDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

type Tab = 'overview' | 'time' | 'tasks'

// ── Main component ─────────────────────────────────────────────────────────────

export function ProjectDetail({ project, timeEntries }: ProjectDetailProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [isPending, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Deliverable completion stored locally
  const deliverables = project.deliverables
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const totalHours   = timeEntries.reduce((s, e) => s + e.hours, 0)
  const billableAmt  = timeEntries
    .filter((e) => e.isBillable && e.rate != null)
    .reduce((s, e) => s + e.hours * e.rate!, 0)

  function toggleDeliverable(item: string) {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(item)) { next.delete(item) } else { next.add(item) }
      return next
    })
  }

  function handleDeleteProject() {
    if (!confirm('Delete this project? Time entries will be kept but unlinked from the project.')) return
    startTransition(async () => {
      const result = await deleteProjectAction(project.id)
      if ('error' in result) { setDeleteError(result.error ?? 'Failed to delete'); return }
      router.push('/projects')
    })
  }

  function handleDeleteEntry(id: string) {
    startTransition(async () => {
      await deleteTimeEntryAction(id)
      router.refresh()
    })
  }

  function handleCompleteProject() {
    startTransition(async () => {
      await updateProjectAction(project.id, { status: 'completed' })
      router.refresh()
    })
  }

  function handleToggleArchived() {
    startTransition(async () => {
      await setProjectArchivedAction(project.id, { archived: !project.isArchived })
      router.refresh()
    })
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'time',     label: `Time${totalHours > 0 ? ` · ${formatHours(totalHours)}` : ''}` },
    { id: 'tasks',    label: `Tasks${project.tasks.length > 0 ? ` · ${project.tasks.filter((t) => !t.isDone).length} open` : ''}` },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight truncate">{project.title}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href={`/clients/${project.clientId}`} className="hover:text-foreground transition-colors">
              {project.clientName}
            </Link>
            {project.startDate && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {formatDate(project.startDate)}
                  {project.endDate ? ` → ${formatDate(project.endDate)}` : ''}
                </span>
              </>
            )}
            {project.budget != null && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <DollarSign className="size-3.5" />
                  {formatCurrency(project.budget)} budget
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {project.status === 'active' && !project.isArchived && (
            <Button variant="outline" size="sm" onClick={handleCompleteProject} disabled={isPending}>
              Mark complete
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleArchived}
            disabled={isPending}
            title={project.isArchived ? 'Restore project' : 'Archive project'}
          >
            {project.isArchived
              ? <><ArchiveRestore className="size-3.5" />Restore</>
              : <><Archive className="size-3.5" />Archive</>}
          </Button>
          <Link href={`/projects/${project.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Pencil className="size-3.5" />
            Edit
          </Link>
          <Button variant="outline" size="sm" onClick={handleDeleteProject} disabled={isPending}
            className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {project.isArchived && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Archive className="size-4 shrink-0" />
          <span>
            This project is archived. It is hidden from your project list and cannot be
            selected for new time entries, tasks, invoices, or forms. Existing records are
            unchanged.
          </span>
        </div>
      )}

      {deleteError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {deleteError}
        </div>
      )}

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <span className="text-xs text-muted-foreground">Time logged</span>
          <span className="text-lg font-semibold tabular-nums">{formatHours(totalHours)}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <span className="text-xs text-muted-foreground">Billable</span>
          <span className="text-lg font-semibold tabular-nums">{formatCurrency(billableAmt)}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <span className="text-xs text-muted-foreground">Deliverables</span>
          <span className="text-lg font-semibold tabular-nums">
            {completed.size}/{deliverables.length}
          </span>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-0.5 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ───────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          {deliverables.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm text-muted-foreground">No deliverables defined.</p>
              <Link href={`/projects/${project.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Add deliverables
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Deliverables
              </p>
              {deliverables.map((item) => {
                const done = completed.has(item)
                return (
                  <button
                    key={item}
                    onClick={() => toggleDeliverable(item)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left hover:bg-muted/40 transition-colors"
                  >
                    {done
                      ? <CheckSquare className="size-4 shrink-0 text-primary" />
                      : <Square className="size-4 shrink-0 text-muted-foreground" />}
                    <span className={done ? 'line-through text-muted-foreground' : ''}>{item}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Time tab ───────────────────────────────────────────────────── */}
      {activeTab === 'time' && (
        <div className="flex flex-col gap-4">
          {/* No new time against an archived project — the server rejects it too. */}
          {!project.isArchived && (
            <TimerWidget
              projectId={project.id}
              projectTitle={project.title}
              defaultRate={project.defaultRate}
            />
          )}

          {timeEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {project.isArchived
                ? 'No time was logged on this project.'
                : 'No time logged yet. Start the timer above.'}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                <span>Entry</span>
                <div className="flex items-center gap-6">
                  <span>Hours</span>
                  <span className="w-20 text-right">Amount</span>
                </div>
              </div>
              <ul>
                {timeEntries.map((entry, idx) => {
                  const lineTotal = entry.rate != null ? entry.hours * entry.rate : null
                  return (
                    <li
                      key={entry.id}
                      className={[
                        'group flex items-center gap-3 px-4 py-2.5 text-sm',
                        idx !== timeEntries.length - 1 ? 'border-b border-border/40' : '',
                      ].join(' ')}
                    >
                      <span className="w-28 shrink-0 text-xs text-muted-foreground">
                        {formatEntryDate(entry.date)}
                      </span>
                      <span className="flex-1 truncate text-muted-foreground">
                        {entry.description ?? <span className="italic">No description</span>}
                      </span>
                      {!entry.isBillable && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[10px] text-muted-foreground">
                          non-billable
                        </span>
                      )}
                      <span className="w-12 shrink-0 text-right tabular-nums font-medium">
                        {formatHours(entry.hours)}
                      </span>
                      <span className="w-20 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
                        {lineTotal != null ? formatCurrency(lineTotal) : '—'}
                      </span>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={isPending}
                        aria-label="Delete entry"
                        className="invisible group-hover:visible shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
              {billableAmt > 0 && (
                <div className="flex items-center justify-end gap-4 border-t border-border bg-muted/20 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{formatHours(totalHours)} total</span>
                  <span className="font-medium">{formatCurrency(billableAmt)} billable</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tasks tab ──────────────────────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <TasksTab
          projectId={project.id}
          tasks={project.tasks}
          isPending={isPending}
          startTransition={startTransition}
          readOnly={project.isArchived}
        />
      )}
    </div>
  )
}

// ── Tasks sub-component ───────────────────────────────────────────────────────

interface TasksTabProps {
  projectId:       string
  tasks:           ProjectTask[]
  isPending:       boolean
  startTransition: (fn: () => Promise<void>) => void
  /** Archived projects cannot take new tasks — createTask rejects them server-side. */
  readOnly?:       boolean
}

function TasksTab({ projectId, tasks, isPending, startTransition, readOnly = false }: TasksTabProps) {
  const router = useRouter()
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open   = tasks.filter((t) => !t.isDone)
  const closed = tasks.filter((t) => t.isDone)

  async function handleToggle(taskId: string, isDone: boolean) {
    startTransition(async () => {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDone: !isDone }),
      })
      router.refresh()
    })
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title }),
      })
      if (!res.ok) { setError('Failed to add task'); return }
      setNewTitle('')
      setAdding(false)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Add task */}
      {readOnly ? null : adding ? (
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            autoFocus
            type="text"
            placeholder="Task title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <Button type="submit" size="sm" disabled={!newTitle.trim() || isPending}>
            {isPending ? <Loader2 className="size-3 animate-spin" /> : 'Add'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setNewTitle('') }}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" />
          Add task
        </Button>
      )}

      {tasks.length === 0 && !adding && (
        <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet.</p>
      )}

      {/* Open tasks */}
      {open.length > 0 && (
        <div className="flex flex-col gap-1">
          {open.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={handleToggle} disabled={isPending} />
          ))}
        </div>
      )}

      {/* Completed tasks */}
      {closed.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-1 mb-1">
            Completed
          </p>
          {closed.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={handleToggle} disabled={isPending} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({
  task,
  onToggle,
  disabled,
}: {
  task: ProjectTask
  onToggle: (id: string, isDone: boolean) => void
  disabled: boolean
}) {
  return (
    <button
      onClick={() => onToggle(task.id, task.isDone)}
      disabled={disabled}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left hover:bg-muted/40 transition-colors disabled:opacity-50 w-full"
    >
      {task.isDone
        ? <CheckSquare className="size-4 shrink-0 text-primary" />
        : <Square className="size-4 shrink-0 text-muted-foreground" />}
      <span className={task.isDone ? 'line-through text-muted-foreground' : ''}>
        {task.title}
      </span>
      {task.dueDate && !task.isDone && (
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
    </button>
  )
}
