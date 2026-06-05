'use client'

import { useState } from 'react'
import { ChevronDown, Building2, FileText, CheckSquare2, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContextMeta, ContextMetaItem } from '@/lib/prompts/types'
import type { ContextItemType } from '@/lib/prompt-engine/types'

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  ContextItemType,
  { label: string; Icon: React.ElementType }
> = {
  client: { label: 'Clients', Icon: Building2 },
  project: { label: 'Projects', Icon: Building2 },
  note: { label: 'Notes', Icon: FileText },
  task: { label: 'Tasks', Icon: CheckSquare2 },
  activity: { label: 'Activities', Icon: Activity },
}

const TYPE_ORDER: ContextItemType[] = ['client', 'project', 'note', 'task', 'activity']

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierChip({ tier }: { tier: 'full' | 'summary' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded px-1.5 py-px text-[10px] font-medium leading-none',
        tier === 'full'
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      )}
    >
      {tier === 'full' ? 'full' : 'summ.'}
    </span>
  )
}

function ScoreDot({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    pct >= 70
      ? 'text-emerald-600 dark:text-emerald-400'
      : pct >= 40
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground'
  return (
    <span className={cn('shrink-0 tabular-nums text-[10px]', color)}>
      {score.toFixed(2)}
    </span>
  )
}

function TypeSection({
  type,
  items,
  omittedCount,
  omittedLabel,
}: {
  type: ContextItemType
  items: ContextMetaItem[]
  omittedCount: number
  omittedLabel: string
}) {
  if (items.length === 0 && omittedCount === 0) return null
  const { label, Icon } = TYPE_CONFIG[type]
  const total = items.length + omittedCount

  return (
    <div className="flex flex-col gap-1.5">
      {/* Section header */}
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {omittedCount > 0 ? `${items.length} of ${total}` : items.length}
        </span>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-1 pl-5">
        {items.map((item) => (
          <div key={item.id} className="flex min-w-0 items-center gap-2">
            <TierChip tier={item.tier} />
            <span
              className="min-w-0 flex-1 truncate text-xs text-foreground/80"
              title={item.label}
            >
              {item.label}
            </span>
            <ScoreDot score={item.score} />
            <span
              className="max-w-[140px] shrink-0 truncate text-[10px] text-muted-foreground"
              title={item.reason}
            >
              {item.reason}
            </span>
          </div>
        ))}

        {omittedCount > 0 && (
          <p className="text-[11px] italic text-muted-foreground">{omittedLabel}</p>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ContextMetaPanelProps {
  meta: ContextMeta
  className?: string
}

export function ContextMetaPanel({ meta, className }: ContextMetaPanelProps) {
  const [open, setOpen] = useState(false)
  const contentId = 'context-meta-content'

  // Group included items by type
  const byType = new Map<ContextItemType, ContextMetaItem[]>()
  for (const item of meta.includedItems) {
    const group = byType.get(item.type) ?? []
    group.push(item)
    byType.set(item.type, group)
  }

  // Group omitted counts by type
  const omittedByType = new Map<ContextItemType, { count: number; label: string }>()
  for (const g of meta.omittedGroups) {
    omittedByType.set(g.type, { count: g.count, label: g.label })
  }

  const totalIncluded = meta.includedItems.length
  const totalOmitted = meta.omittedGroups.reduce((s, g) => s + g.count, 0)

  const summaryParts: string[] = [
    `${totalIncluded} item${totalIncluded !== 1 ? 's' : ''}`,
  ]
  if (totalOmitted > 0) summaryParts.push(`${totalOmitted} omitted`)
  if (meta.deduplicatedNoteCount > 0) {
    summaryParts.push(
      `${meta.deduplicatedNoteCount} duplicate ${meta.deduplicatedNoteCount === 1 ? 'note' : 'notes'} removed`,
    )
  }
  const summary = summaryParts.join(' · ')

  return (
    <div className={cn('border-t border-border', className)}>
      {/* Toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div>
          <p className="text-sm font-medium">What&apos;s included</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>
        </div>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Expandable content */}
      <div
        id={contentId}
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
            {TYPE_ORDER.map((type) => {
              const items = byType.get(type) ?? []
              const omitted = omittedByType.get(type)
              if (items.length === 0 && !omitted) return null
              return (
                <TypeSection
                  key={type}
                  type={type}
                  items={items}
                  omittedCount={omitted?.count ?? 0}
                  omittedLabel={omitted?.label ?? ''}
                />
              )
            })}

            {totalIncluded === 0 && totalOmitted === 0 && (
              <p className="text-xs text-muted-foreground">No context items were included.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
