'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { Clock, DollarSign, Trash2, ExternalLink, Archive, ArchiveRestore } from 'lucide-react'
import { ProjectStatusBadge } from './project-status-badge'
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

type StatusFilter = 'all' | 'active' | 'on_hold' | 'completed' | 'cancelled'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
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

  const filtered = statusFilter === 'all'
    ? projects
    : projects.filter((p) => p.status === statusFilter)

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this project? This cannot be undone.')) return
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
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group relative flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 text-sm transition-colors hover:bg-muted/40"
            >
              {/* Status dot */}
              <span className={[
                'mt-0.5 size-2 shrink-0 rounded-full',
                project.status === 'active'    ? 'bg-green-500' :
                project.status === 'completed' ? 'bg-blue-500' :
                project.status === 'on_hold'   ? 'bg-yellow-500' :
                'bg-muted-foreground/40',
              ].join(' ')} />

              {/* Main content */}
              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{project.title}</span>
                  <ProjectStatusBadge status={project.status} />
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
              <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                {project.totalHours > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatHours(project.totalHours)}
                  </span>
                )}
                {project.budget != null && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="size-3" />
                    {formatCurrency(project.budget)}
                  </span>
                )}
                <ExternalLink className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Row actions */}
              <div className="absolute right-3 top-3 hidden group-hover:flex items-center gap-1">
                <button
                  onClick={(e) => handleToggleArchived(e, project.id)}
                  disabled={isPending && archivingId === project.id}
                  aria-label={archived ? 'Restore project' : 'Archive project'}
                  title={archived ? 'Restore project' : 'Archive project'}
                  className="flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {archived
                    ? <ArchiveRestore className="size-3.5" />
                    : <Archive className="size-3.5" />}
                </button>
                <button
                  onClick={(e) => handleDelete(e, project.id)}
                  disabled={isPending && deletingId === project.id}
                  aria-label="Delete project"
                  title="Delete project"
                  className="flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
