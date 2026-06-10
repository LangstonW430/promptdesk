'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Receipt, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { deleteTimeEntryAction } from '@/lib/actions/time-entries'
import type { SerializedTimeEntry } from '@/lib/time-entries/serialize'
import { currentMondayISO, shiftWeek, formatWeekRange as formatRange } from '@/lib/time-entries/week'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatHours(h: number): string {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(2)}h`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount)
}

// ── Grouping ──────────────────────────────────────────────────────────────────

interface ProjectGroup {
  projectId:    string
  projectTitle: string
  clientName:   string
  entries:      SerializedTimeEntry[]
  totalHours:   number
  billableAmt:  number
}

function groupEntries(entries: SerializedTimeEntry[]): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>()

  for (const e of entries) {
    let pg = map.get(e.projectId)
    if (!pg) {
      pg = {
        projectId:    e.projectId,
        projectTitle: e.projectTitle,
        clientName:   e.clientName,
        entries:      [],
        totalHours:   0,
        billableAmt:  0,
      }
      map.set(e.projectId, pg)
    }

    pg.entries.push(e)
    pg.totalHours += e.hours
    if (e.isBillable && e.rate != null) pg.billableAmt += e.hours * e.rate
  }

  return Array.from(map.values())
}

// ── Main component ────────────────────────────────────────────────────────────

interface WeeklyTimesheetProps {
  entries:   SerializedTimeEntry[]
  weekStart: string
}

export function WeeklyTimesheet({ entries, weekStart }: WeeklyTimesheetProps) {
  const router = useRouter()
  const [selected,     setSelected]    = useState<Set<string>>(new Set())
  const [isPending,    startTransition] = useTransition()

  const groups = groupEntries(entries)
  const totalHours    = entries.reduce((s, e) => s + e.hours, 0)
  const billableHours = entries.filter((e) => e.isBillable).reduce((s, e) => s + e.hours, 0)

  const isCurrentWeek = weekStart === currentMondayISO()

  function toggleEntry(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    const billableWithRate = entries.filter((e) => e.isBillable && e.rate != null).map((e) => e.id)
    if (billableWithRate.every((id) => selected.has(id))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(billableWithRate))
    }
  }

  function handleDelete(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
    startTransition(async () => {
      const result = await deleteTimeEntryAction(id)
      if (!('error' in result)) router.refresh()
    })
  }

  function handleConvert() {
    if (selected.size === 0) return
    const ids = Array.from(selected).join(',')
    router.push(`/invoices/new?entries=${ids}`)
  }

  const selectedEntries  = entries.filter((e) => selected.has(e.id))
  const selectedTotal    = selectedEntries.reduce((s, e) => s + e.hours * (e.rate ?? 0), 0)
  const billableSelectableIds = entries.filter((e) => e.isBillable && e.rate != null).map((e) => e.id)
  const allBillableSelected   = billableSelectableIds.length > 0 && billableSelectableIds.every((id) => selected.has(id))

  return (
    <div className="flex flex-col gap-6">
      {/* ── Week navigation ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => router.push(`/time?weekStart=${shiftWeek(weekStart, -1)}`)}
            disabled={isPending}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[180px] text-center text-sm font-medium">
            {formatRange(weekStart)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => router.push(`/time?weekStart=${shiftWeek(weekStart, 1)}`)}
            disabled={isPending || isCurrentWeek}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{formatHours(totalHours)} total</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{formatHours(billableHours)} billable</span>
        </div>
      </div>

      {/* ── Convert toolbar ───────────────────────────────────────────────── */}
      {billableSelectableIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={allBillableSelected}
              onChange={toggleAll}
              className="rounded border-input accent-primary"
              aria-label="Select all billable entries"
            />
            <span className="text-sm text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} selected — ${formatCurrency(selectedTotal)}`
                : 'Select billable entries to invoice'}
            </span>
          </label>

          <Button
            size="sm"
            className="ml-auto"
            disabled={selected.size === 0 || isPending}
            onClick={handleConvert}
          >
            {isPending ? <Loader2 className="size-3 animate-spin" /> : <Receipt className="size-3" />}
            Convert to invoice
          </Button>
        </div>
      )}

      {/* ── Entry groups ─────────────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No time logged this week.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((pg) => (
            <div key={pg.projectId} className="overflow-hidden rounded-xl border border-border">
              {/* Project header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{pg.projectTitle}</span>
                  <span className="text-xs text-muted-foreground">{pg.clientName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatHours(pg.totalHours)}</span>
                  {pg.billableAmt > 0 && (
                    <span className="text-foreground font-medium">{formatCurrency(pg.billableAmt)}</span>
                  )}
                </div>
              </div>

              {/* Entries */}
              <ul>
                {pg.entries.map((entry, idx) => {
                  const isSelectable = entry.isBillable && entry.rate != null
                  const isSelected   = selected.has(entry.id)
                  const lineTotal    = entry.rate != null ? entry.hours * entry.rate : null

                  return (
                    <li
                      key={entry.id}
                      className={cn(
                        'group flex items-center gap-3 px-4 py-2.5 text-sm',
                        idx !== pg.entries.length - 1 && 'border-b border-border/40',
                        isSelected && 'bg-primary/5',
                      )}
                    >
                      {/* Selection checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isSelectable || isPending}
                        onChange={() => toggleEntry(entry.id)}
                        className={cn('rounded border-input accent-primary', !isSelectable && 'invisible')}
                        aria-label={`Select entry: ${entry.description ?? entry.date}`}
                      />

                      {/* Date */}
                      <span className="w-28 shrink-0 text-xs text-muted-foreground">
                        {formatDate(entry.date)}
                      </span>

                      {/* Description */}
                      <span className="flex-1 truncate text-muted-foreground">
                        {entry.description ?? <span className="italic">No description</span>}
                      </span>

                      {/* Billable badge */}
                      {!entry.isBillable && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[10px] font-medium text-muted-foreground">
                          non-billable
                        </span>
                      )}

                      {/* Hours */}
                      <span className="w-12 shrink-0 text-right tabular-nums font-medium">
                        {formatHours(entry.hours)}
                      </span>

                      {/* Rate / line total */}
                      <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground text-xs">
                        {lineTotal != null
                          ? formatCurrency(lineTotal)
                          : entry.rate != null
                            ? `@ $${entry.rate}/hr`
                            : '—'}
                      </span>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={isPending}
                        aria-label="Delete entry"
                        className="invisible shrink-0 group-hover:visible text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
