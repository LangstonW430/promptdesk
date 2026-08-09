'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { DollarSign } from 'lucide-react'
import { StageBadge } from '@/components/clients/stage-badge'
import { CLIENT_STAGES, CLIENT_STAGE_LABELS, type ClientStage } from '@/lib/clients/stage'
import type { SerializedClient } from '@/components/clients/client-table'

// ── Helpers ────────────────────────────────────────────────────────────────

// What puts a client in each column, shown under the heading. The board is a
// view of the work, not a place to file people — a card moves when a project
// is quoted, started or finished, not when someone drags it.
const STAGE_HINTS: Record<ClientStage, string> = {
  lead: 'No contact logged',
  contacted: 'Contacted, nothing quoted',
  proposal_out: 'Project proposed',
  active: 'Project underway',
  past: 'Work completed',
  lost: 'Archived',
}

function formatCurrency(value: number | null): string {
  if (value == null) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

// ── KanbanBoard ────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  clients: SerializedClient[]
}

export function KanbanBoard({ clients }: KanbanBoardProps) {
  const byStage = new Map<ClientStage, SerializedClient[]>()
  for (const stage of CLIENT_STAGES) byStage.set(stage, [])
  for (const client of clients) {
    byStage.get(client.stage as ClientStage)?.push(client)
  }

  // "Lost" means archived, so it is empty in every view except the archived
  // one — shown only when it holds something rather than as a dead column.
  const columns = CLIENT_STAGES.filter(
    (stage) => stage !== 'lost' || (byStage.get(stage)?.length ?? 0) > 0,
  )

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" role="list" aria-label="Client pipeline">
      {columns.map((stage) => (
        <KanbanColumn key={stage} stage={stage} clients={byStage.get(stage) ?? []} />
      ))}
    </div>
  )
}

// ── KanbanColumn ───────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  clients,
}: {
  stage: ClientStage
  clients: SerializedClient[]
}) {
  return (
    <div
      role="listitem"
      aria-label={`${CLIENT_STAGE_LABELS[stage]} column, ${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`}
      className="flex w-[220px] shrink-0 flex-col gap-2"
    >
      {/* Column header */}
      <div className="px-0.5 pb-1">
        <div className="flex items-center justify-between">
          <StageBadge stage={stage} />
          <span className="text-xs tabular-nums text-muted-foreground">{clients.length}</span>
        </div>
        <p className="mt-1 text-[11px] leading-tight text-muted-foreground/70">
          {STAGE_HINTS[stage]}
        </p>
      </div>

      <div className="flex min-h-[120px] flex-col gap-2 rounded-xl bg-muted/40 p-2">
        {clients.map((client) => (
          <KanbanCard key={client.id} client={client} />
        ))}

        {clients.length === 0 && (
          <p className="flex flex-1 items-center justify-center py-6 text-xs text-muted-foreground/60 select-none">
            Nobody here
          </p>
        )}
      </div>
    </div>
  )
}

// ── KanbanCard ─────────────────────────────────────────────────────────────

function KanbanCard({ client }: { client: SerializedClient }) {
  const router = useRouter()

  const handleCardClick = useCallback(() => {
    router.push(`/clients/${client.id}`)
  }, [router, client.id])

  return (
    <button
      onClick={handleCardClick}
      aria-label={`Open ${client.companyName ?? client.contactName ?? 'client'}`}
      className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <p className="text-sm font-medium leading-tight">
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
  )
}
