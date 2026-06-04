'use client'

import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'
import {
  Search,
  Plus,
  X,
  Users,
  Thermometer,
  ChevronRight,
  List,
  LayoutGrid,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/clients/status-badge'
import { KanbanBoard } from '@/components/clients/kanban-board'
import { cn } from '@/lib/utils'
import { CLIENT_STATUSES } from '@/lib/clients/types'

// ── Types ──────────────────────────────────────────────────────────────────

export type SerializedClient = {
  id: string
  companyName: string | null
  contactName: string | null
  email: string | null
  industry: string | null
  status: string
  estimatedValue: number | null
  lastContactDate: string | null
  nextFollowupDate: string | null
  clientTags: Array<{ tag: { id: string; label: string } }>
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  proposal_sent: 'Proposal sent',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

// ── Main component ─────────────────────────────────────────────────────────

export function ClientTable({ clients }: { clients: SerializedClient[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentQ = searchParams.get('q') ?? ''
  const currentStatus = searchParams.get('status') ?? ''
  const currentTag = searchParams.get('tag') ?? ''
  const isGoingCold = searchParams.get('stale') === '30'
  const currentView = searchParams.get('view') === 'kanban' ? 'kanban' : 'table'

  const [searchInput, setSearchInput] = useState(currentQ)
  const [tagInput, setTagInput] = useState(currentTag)

  const hasActiveFilters =
    currentQ !== '' || currentStatus !== '' || currentTag !== '' || isGoingCold

  function pushFilters(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  // Debounce search input → URL
  useEffect(() => {
    const t = setTimeout(() => {
      pushFilters({ q: searchInput || null })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // Debounce tag input → URL
  useEffect(() => {
    const t = setTimeout(() => {
      pushFilters({ tag: tagInput || null })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagInput])

  function clearAllFilters() {
    setSearchInput('')
    setTagInput('')
    startTransition(() => {
      router.replace(
        `${pathname}${currentView === 'kanban' ? '?view=kanban' : ''}`,
        { scroll: false },
      )
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
            aria-label="Search clients"
          />
        </div>

        {/* Status filter (hidden in Kanban — columns already separate by status) */}
        {currentView === 'table' && (
          <select
            value={currentStatus}
            onChange={(e) => pushFilters({ status: e.target.value || null })}
            aria-label="Filter by status"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All statuses</option>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        )}

        {/* Tag filter */}
        <Input
          placeholder="Tag…"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          className="w-28"
          aria-label="Filter by tag"
        />

        {/* Going cold toggle */}
        <Button
          variant={isGoingCold ? 'secondary' : 'outline'}
          onClick={() => pushFilters({ stale: isGoingCold ? null : '30' })}
          aria-pressed={isGoingCold}
        >
          <Thermometer />
          Going cold
        </Button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearAllFilters} size="sm">
            <X />
            Clear
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div
            role="group"
            aria-label="View mode"
            className="flex items-center gap-0.5 rounded-lg border border-border p-0.5"
          >
            <Button
              variant={currentView === 'table' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => pushFilters({ view: null })}
              aria-label="Table view"
              aria-pressed={currentView === 'table'}
            >
              <List />
            </Button>
            <Button
              variant={currentView === 'kanban' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => pushFilters({ view: 'kanban' })}
              aria-label="Kanban view"
              aria-pressed={currentView === 'kanban'}
            >
              <LayoutGrid />
            </Button>
          </div>

          <Button onClick={() => router.push('/clients/new')}>
            <Plus />
            Add client
          </Button>
        </div>
      </div>

      {/* ── Kanban view ──────────────────────────────────────────────────── */}
      {currentView === 'kanban' ? (
        <div className={cn('transition-opacity duration-150', isPending && 'opacity-50')}>
          <KanbanBoard clients={clients} />
          {clients.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {clients.length} {clients.length === 1 ? 'client' : 'clients'}
              {hasActiveFilters && ' matching filters'}
            </p>
          )}
        </div>
      ) : (
        /* ── Table view ──────────────────────────────────────────────────── */
        <>
          <div
            className={cn(
              'rounded-xl border border-border bg-card transition-opacity duration-150',
              isPending && 'opacity-50',
            )}
          >
            {clients.length === 0 ? (
              <EmptyState hasFilters={hasActiveFilters} onClear={clearAllFilters} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        'Company / Contact',
                        'Status',
                        'Industry',
                        'Est. Value',
                        'Last Contact',
                        'Next Follow-up',
                        '',
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-medium tracking-wide text-muted-foreground first:pl-5 last:w-8"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <ClientRow
                        key={client.id}
                        client={client}
                        onClick={() => router.push(`/clients/${client.id}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {clients.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {clients.length} {clients.length === 1 ? 'client' : 'clients'}
              {hasActiveFilters && ' matching filters'}
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ── Row ────────────────────────────────────────────────────────────────────

function ClientRow({
  client,
  onClick,
}: {
  client: SerializedClient
  onClick: () => void
}) {
  const overdue = isOverdue(client.nextFollowupDate)

  return (
    <tr
      onClick={onClick}
      className="group cursor-pointer border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
    >
      {/* Company / Contact */}
      <td className="pl-5 pr-4 py-3">
        <div className="font-medium leading-tight">
          {client.companyName ?? (
            <span className="text-muted-foreground italic">No company</span>
          )}
        </div>
        {client.contactName && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {client.contactName}
          </div>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={client.status} />
      </td>

      {/* Industry */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {client.industry ?? '—'}
      </td>

      {/* Est. Value */}
      <td className="px-4 py-3 tabular-nums text-sm">
        {formatCurrency(client.estimatedValue)}
      </td>

      {/* Last Contact */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formatDate(client.lastContactDate)}
      </td>

      {/* Next Follow-up */}
      <td className="px-4 py-3 text-sm">
        <span
          className={cn(
            overdue && client.nextFollowupDate
              ? 'font-medium text-amber-600 dark:text-amber-400'
              : 'text-muted-foreground',
          )}
        >
          {formatDate(client.nextFollowupDate)}
        </span>
      </td>

      {/* Chevron */}
      <td className="pr-4 py-3 text-muted-foreground">
        <ChevronRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </td>
    </tr>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean
  onClear: () => void
}) {
  const router = useRouter()

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Search className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">No clients match your filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search or filters
          </p>
        </div>
        <Button variant="outline" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Users className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">No clients yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your first client or import from CSV to start building your pipeline
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => router.push('/clients/new')}>
          <Plus />
          Add your first client
        </Button>
        <Link href="/settings" className={cn(buttonVariants({ variant: 'outline' }))}>
          Import from CSV
        </Link>
      </div>
    </div>
  )
}
