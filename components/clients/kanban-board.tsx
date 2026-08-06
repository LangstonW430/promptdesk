'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  rectIntersection,
  type Announcements,
  type DragStartEvent,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import { GripVertical, DollarSign } from 'lucide-react'
import { StatusBadge } from '@/components/clients/status-badge'
import { cn } from '@/lib/utils'
import { CLIENT_STATUSES, type ClientStatus } from '@/lib/clients/types'
import { changeClientStatusAction } from '@/lib/actions/clients'
import type { SerializedClient } from '@/components/clients/client-table'

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ClientStatus, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  proposal_sent: 'Proposal sent',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
}

function formatCurrency(value: number | null): string {
  if (value == null) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

// ── Keyboard coordinate getter ─────────────────────────────────────────────
// Moves the dragged card to the center of the adjacent column on ArrowLeft/Right.

const kanbanCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context: { active, droppableRects } },
) => {
  if (!active || !['ArrowLeft', 'ArrowRight'].includes(event.code)) return

  // Determine which column the drag card currently overlaps the most.
  const translated = active.rect.current.translated
  if (!translated) return

  let bestStatus: ClientStatus | null = null
  let bestOverlap = -Infinity

  for (const status of CLIENT_STATUSES) {
    const rect = droppableRects.get(status)
    if (!rect) continue
    const overlapX =
      Math.min(translated.right, rect.left + rect.width) -
      Math.max(translated.left, rect.left)
    const overlapY =
      Math.min(translated.bottom, rect.top + rect.height) -
      Math.max(translated.top, rect.top)
    const area = overlapX > 0 && overlapY > 0 ? overlapX * overlapY : 0
    if (area > bestOverlap) {
      bestOverlap = area
      bestStatus = status
    }
  }

  if (!bestStatus) return

  const currentIndex = CLIENT_STATUSES.indexOf(bestStatus)
  const delta = event.code === 'ArrowLeft' ? -1 : 1
  const nextIndex = Math.max(0, Math.min(CLIENT_STATUSES.length - 1, currentIndex + delta))
  const nextStatus = CLIENT_STATUSES[nextIndex]

  const nextRect = droppableRects.get(nextStatus)
  if (!nextRect) return

  event.preventDefault()
  return {
    x: nextRect.left + nextRect.width / 2,
    y: nextRect.top + nextRect.height / 2,
  }
}

// ── KanbanBoard ────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  clients: SerializedClient[]
}

export function KanbanBoard({ clients }: KanbanBoardProps) {
  const [optimisticClients, setOptimisticClients] = useState(clients)
  const [activeCard, setActiveCard] = useState<SerializedClient | null>(null)
  const [, startTransition] = useTransition()

  // Sync when server re-renders with fresh data
  useEffect(() => {
    setOptimisticClients(clients)
  }, [clients])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: kanbanCoordinateGetter }),
  )

  function handleDragStart({ active }: DragStartEvent) {
    const card = optimisticClients.find((c) => c.id === active.id)
    setActiveCard(card ?? null)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCard(null)

    if (!over) return

    const clientId = String(active.id)
    const newStatus = String(over.id) as ClientStatus
    const card = optimisticClients.find((c) => c.id === clientId)
    if (!card || card.status === newStatus) return

    const snapshot = optimisticClients

    // Optimistic update — immediate
    setOptimisticClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c)),
    )

    startTransition(async () => {
      const result = await changeClientStatusAction(clientId, newStatus)
      if ('error' in result) {
        // Revert to pre-drag snapshot
        setOptimisticClients(snapshot)
      }
    })
  }

  function handleDragCancel() {
    setActiveCard(null)
  }

  // Announcements for screen readers — typed against the Announcements interface
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const card = optimisticClients.find((c) => c.id === active.id)
      const name = card?.companyName ?? card?.contactName ?? 'Client'
      return `Picked up ${name}. Use Arrow Left and Right to move between columns, Space to drop, Escape to cancel.`
    },
    onDragOver: ({ active, over }) => {
      const card = optimisticClients.find((c) => c.id === active.id)
      const name = card?.companyName ?? card?.contactName ?? 'Client'
      if (!over) return `${name} is not over a column.`
      return `${name} is over the ${STATUS_LABELS[String(over.id) as ClientStatus] ?? String(over.id)} column.`
    },
    onDragEnd: ({ active, over }) => {
      const card = optimisticClients.find((c) => c.id === active.id)
      const name = card?.companyName ?? card?.contactName ?? 'Client'
      if (!over) return `${name} was not dropped on a column.`
      return `${name} was moved to ${STATUS_LABELS[String(over.id) as ClientStatus] ?? String(over.id)}.`
    },
    onDragCancel: ({ active }) => {
      const card = optimisticClients.find((c) => c.id === active.id)
      const name = card?.companyName ?? card?.contactName ?? 'Client'
      return `Dragging ${name} was cancelled.`
    },
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{ announcements }}
    >
      <div className="flex gap-3 overflow-x-auto pb-4" role="list" aria-label="Client pipeline">
        {CLIENT_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            clients={optimisticClients.filter((c) => c.status === status)}
          />
        ))}
      </div>

      {/* Ghost card rendered at cursor while dragging */}
      <DragOverlay dropAnimation={{ duration: 150 }}>
        {activeCard && <CardOverlay client={activeCard} />}
      </DragOverlay>
    </DndContext>
  )
}

// ── KanbanColumn ───────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  clients,
}: {
  status: ClientStatus
  clients: SerializedClient[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      role="listitem"
      aria-label={`${STATUS_LABELS[status]} column, ${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`}
      className="flex w-[220px] shrink-0 flex-col gap-2"
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-0.5 pb-1">
        <StatusBadge status={status} />
        <span className="text-xs tabular-nums text-muted-foreground">{clients.length}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[120px] flex-col gap-2 rounded-xl p-2 transition-colors duration-150',
          isOver
            ? 'bg-primary/5 ring-2 ring-primary/20'
            : 'bg-muted/40',
        )}
      >
        {clients.map((client) => (
          <KanbanCard key={client.id} client={client} />
        ))}

        {clients.length === 0 && !isOver && (
          <p className="flex flex-1 items-center justify-center py-6 text-xs text-muted-foreground/60 select-none">
            Drop here
          </p>
        )}
      </div>
    </div>
  )
}

// ── KanbanCard ─────────────────────────────────────────────────────────────

function KanbanCard({ client }: { client: SerializedClient }) {
  const router = useRouter()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: client.id })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const handleCardClick = useCallback(() => {
    router.push(`/clients/${client.id}`)
  }, [router, client.id])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow',
        isDragging && 'opacity-0',
      )}
    >
      {/* Drag handle — separate from click-to-navigate area */}
      <button
        {...attributes}
        {...listeners}
        tabIndex={0}
        className="absolute right-2 top-2 cursor-grab rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-muted-foreground focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
        aria-label={`Drag ${client.companyName ?? client.contactName ?? 'client'} to change status`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Card body — clicking navigates to client detail */}
      <button
        onClick={handleCardClick}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:rounded-lg"
        aria-label={`Open ${client.companyName ?? client.contactName ?? 'client'}`}
      >
        <p className="pr-5 text-sm font-medium leading-tight">
          {client.companyName ?? (
            <span className="italic text-muted-foreground">No company</span>
          )}
        </p>

        {client.contactName && (
          <p className="mt-0.5 text-xs text-muted-foreground">{client.contactName}</p>
        )}

        {client.pipelineValue != null && (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-foreground">
            <DollarSign className="size-3 text-muted-foreground" />
            {formatCurrency(client.pipelineValue).replace('$', '')}
          </p>
        )}
      </button>
    </div>
  )
}

// ── CardOverlay ────────────────────────────────────────────────────────────
// Rendered inside DragOverlay — no DnD hooks, just display.

function CardOverlay({ client }: { client: SerializedClient }) {
  return (
    <div className="w-[220px] rotate-1 rounded-lg border border-primary/30 bg-card p-3 shadow-xl ring-2 ring-primary/20">
      <p className="pr-5 text-sm font-medium leading-tight">
        {client.companyName ?? (
          <span className="italic text-muted-foreground">No company</span>
        )}
      </p>
      {client.contactName && (
        <p className="mt-0.5 text-xs text-muted-foreground">{client.contactName}</p>
      )}
      {client.pipelineValue != null && (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-foreground">
          <DollarSign className="size-3 text-muted-foreground" />
          {formatCurrency(client.pipelineValue).replace('$', '')}
        </p>
      )}
    </div>
  )
}
