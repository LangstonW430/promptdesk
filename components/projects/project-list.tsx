'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { Clock, Trash2, Archive, ArchiveRestore } from 'lucide-react'
import { projectStatusConfig } from './project-status-badge'
import { ProjectStatusSelect } from './project-status-select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteProjectAction, setProjectArchivedAction } from '@/lib/actions/projects'
import type { ProjectWithStats } from '@/lib/projects'

function formatHours(h: number): string {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(d: Date | string | null): string | null {
  if (!d) return null
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type StatusFilter = 'all' | 'proposed' | 'active' | 'on_hold' | 'completed' | 'cancelled'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'proposed',  label: 'Proposed' },
  { value: 'active',    label: 'Active' },
  { value: 'on_hold',   label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

interface ProjectListProps {
  projects: ProjectWithStats[]
  /** True when the list is showing archived projects rather than active ones. */
  archived?: boolean
}

export function ProjectList({ projects, archived = false }: ProjectListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ProjectWithStats | null>(null)

  const filtered = statusFilter === 'all'
    ? projects
    : projects.filter((p) => p.status === statusFilter)

  // Was a bare window.confirm(). ConfirmDialog is what every other destructive
  // path in the app uses, and it can name the project being deleted.
  function handleDeleteConfirmed() {
    const id = pendingDelete?.id
    if (!id) return
    setPendingDelete(null)
    setDeletingId(id)
    startTransition(async () => {
      await deleteProjectAction(id)
      setDeletingId(null)
      router.refresh()
    })
  }

  function handleToggleArchived(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    setArchivingId(id)
    startTransition(async () => {
      await setProjectArchivedAction(id, { archived: !archived })
      setArchivingId(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
        {STATUS_TABS.map((tab) => {
          const count = tab.value === 'all'
            ? projects.length
            : projects.filter((p) => p.status === tab.value).length
          if (tab.value !== 'all' && count === 0) return null
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={[
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {tab.label}
              <span className="text-xs text-muted-foreground">{count}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        archived ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No archived projects.
          </p>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No projects yet.{' '}
            <Link href="/projects/new" className="text-foreground underline underline-offset-2">
              Create your first project
            </Link>
          </p>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((project) => (
            /* A div, not a wrapping <Link>. The row carries a status <select>
               and two buttons, and interactive controls cannot legally nest
               inside an anchor — the title below is the link instead, which is
               also what makes the row reachable by keyboard. */
            <div
              key={project.id}
              onClick={(e) => {
                // Clicks that landed on the title link, the status picker or an
                // action button are already handled there.
                if ((e.target as HTMLElement).closest('a,button,select')) return
                router.push(`/projects/${project.id}`)
              }}
              className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 text-sm transition-colors hover:bg-muted/40"
            >
              {/* Status dot */}
              <span
                className={[
                  'size-2 shrink-0 rounded-full',
                  projectStatusConfig(project.status).dotClassName,
                ].join(' ')}
              />

              {/* Main content */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/projects/${project.id}`}
                    className="truncate rounded font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {project.title}
                  </Link>
                  <ProjectStatusSelect
                    projectId={project.id}
                    status={project.status}
                    className="shrink-0"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{project.clientName}</span>
                  {project.startDate && (
                    <>
                      <span>·</span>
                      <span>
                        {formatDate(project.startDate)}
                        {project.endDate ? ` → ${formatDate(project.endDate)}` : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                {project.totalHours > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatHours(project.totalHours)}
                  </span>
                )}
                {/* No icon: formatCurrency already emits the currency symbol,
                    so a DollarSign beside it rendered "$ $8,500". The hours
                    above keep their clock because "42.5h" carries no glyph of
                    its own. */}
                {project.budget != null && (
                  <span className="tabular-nums">{formatCurrency(project.budget)}</span>
                )}
              </div>

              {/* Row actions. In the normal flow rather than absolutely
                  positioned: they used to sit on top of the hours and budget
                  above, so hovering a row covered its own figures. Reserving
                  the space with opacity keeps the layout still on hover, and
                  keeps the buttons in the tab order — `hidden` did not. */}
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <button
                  onClick={(e) => handleToggleArchived(e, project.id)}
                  disabled={isPending && archivingId === project.id}
                  aria-label={`${archived ? 'Restore' : 'Archive'} ${project.title}`}
                  title={archived ? 'Restore project' : 'Archive project'}
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  {archived
                    ? <ArchiveRestore className="size-3.5" />
                    : <Archive className="size-3.5" />}
                </button>
                <button
                  onClick={() => setPendingDelete(project)}
                  disabled={isPending && deletingId === project.id}
                  aria-label={`Delete ${project.title}`}
                  title="Delete project"
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
        title="Delete this project?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" and its tasks will be permanently deleted. Logged time and any invoices raised against it are kept. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete project"
        variant="destructive"
        onConfirm={handleDeleteConfirmed}
        isPending={isPending}
      />
    </div>
  )
}
