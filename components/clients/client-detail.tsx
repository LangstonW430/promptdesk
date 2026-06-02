'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  Mail, Phone, Globe, Building2, Users, ArrowUpRight,
  DollarSign, Briefcase, Calendar, CalendarCheck,
  Lightbulb, Tag, X, Pencil, Archive, RotateCcw, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/clients/status-badge'
import { cn } from '@/lib/utils'
import { CLIENT_STATUSES } from '@/lib/clients/types'
import { changeClientStatusAction, setClientArchivedAction } from '@/lib/actions/clients'

// ── Types ──────────────────────────────────────────────────────────────────

export type SerializedClientDetail = {
  id: string
  companyName: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
  industry: string | null
  companySize: string | null
  leadSource: string | null
  status: string
  estimatedValue: number | null
  projectType: string | null
  painPoints: string | null
  requirements: string | null
  opportunityNotes: string | null
  lastContactDate: string | null
  nextFollowupDate: string | null
  isArchived: boolean
  createdAt: string
  updatedAt: string
  clientTags: Array<{ tag: { id: string; label: string; color: string | null } }>
  notes: Array<{ id: string; body: string; noteType: string; occurredAt: string }>
  tasks: Array<{ id: string; title: string; dueDate: string | null; isDone: boolean }>
  attachments: Array<{
    id: string
    fileName: string
    mimeType: string | null
    sizeBytes: number | null
    createdAt: string
  }>
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead', contacted: 'Contacted', proposal_sent: 'Proposal sent',
  negotiating: 'Negotiating', won: 'Won', lost: 'Lost',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(value)
}

function isOverdue(iso: string | null): boolean {
  return !!iso && new Date(iso) < new Date()
}

// ── Tabs ───────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'notes' | 'intelligence' | 'tasks' | 'attachments'

// ── Main component ─────────────────────────────────────────────────────────

interface ClientDetailProps {
  client: SerializedClientDetail
  onClose?: () => void
}

export function ClientDetail({ client, onClose }: ClientDetailProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [localStatus, setLocalStatus] = useState(client.status)
  const [isPending, startTransition] = useTransition()

  useEffect(() => { setLocalStatus(client.status) }, [client.status])

  const displayName = client.companyName ?? client.contactName ?? 'Unnamed client'

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'notes', label: 'Notes', count: client.notes.length || undefined },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'tasks', label: 'Tasks', count: client.tasks.filter((t) => !t.isDone).length || undefined },
    { id: 'attachments', label: 'Attachments', count: client.attachments.length || undefined },
  ]

  function handleStatusChange(newStatus: string) {
    if (newStatus === localStatus) return
    setLocalStatus(newStatus)
    startTransition(async () => {
      const result = await changeClientStatusAction(client.id, newStatus)
      if ('error' in result) {
        setLocalStatus(client.status)
      } else {
        router.refresh()
      }
    })
  }

  function handleArchiveToggle() {
    startTransition(async () => {
      const result = await setClientArchivedAction(client.id, { archived: !client.isArchived })
      if (!('error' in result)) {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col">
      {/* ── Sticky header ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-popover">
        {/* Name row */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight leading-tight">
              {displayName}
            </h2>
            {client.contactName && client.companyName && (
              <p className="mt-0.5 text-sm text-muted-foreground">{client.contactName}</p>
            )}
          </div>
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close panel">
              <X />
            </Button>
          )}
        </div>

        {/* Quick actions row */}
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
          <StatusBadge status={localStatus} />
          {client.isArchived && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Archived
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {/* Status change */}
            <select
              value={localStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isPending}
              aria-label="Change status"
              className="h-7 rounded-lg border border-input bg-transparent px-2 py-1 text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/clients/${client.id}/edit`)}
              disabled={isPending}
            >
              <Pencil />
              Edit
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleArchiveToggle}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="animate-spin" />
              ) : client.isArchived ? (
                <RotateCcw />
              ) : (
                <Archive />
              )}
              {client.isArchived ? 'Restore' : 'Archive'}
            </Button>
          </div>
        </div>

        {/* Tab nav */}
        <div role="tablist" className="flex px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative -mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.count != null && (
                <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────── */}
      <div>
        {activeTab === 'overview' && <OverviewTab client={client} />}
        {activeTab === 'notes' && (
          <PlaceholderTab
            label="Notes"
            description="Timestamped notes, calls, and meetings will appear here."
          />
        )}
        {activeTab === 'intelligence' && (
          <IntelligenceTab
            client={client}
            onEdit={() => router.push(`/clients/${client.id}/edit`)}
          />
        )}
        {activeTab === 'tasks' && (
          <PlaceholderTab
            label="Tasks"
            description="Follow-up tasks and to-dos for this client will appear here."
          />
        )}
        {activeTab === 'attachments' && (
          <PlaceholderTab
            label="Attachments"
            description="Proposals, contracts, and screenshots will appear here."
          />
        )}
      </div>
    </div>
  )
}

// ── Overview tab ───────────────────────────────────────────────────────────

function OverviewTab({ client }: { client: SerializedClientDetail }) {
  const followupOverdue = isOverdue(client.nextFollowupDate)

  const hasContact = !!(client.email || client.phone || client.website)
  const hasPipeline = !!(
    client.estimatedValue != null ||
    client.industry || client.companySize ||
    client.leadSource || client.projectType
  )

  return (
    <div className="flex flex-col gap-6 p-5">
      {/* Contact */}
      <section>
        <SectionHeading>Contact</SectionHeading>
        {hasContact ? (
          <dl className="flex flex-col gap-2.5">
            {client.email && (
              <FieldRow icon={<Mail />} label="Email">
                <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                  {client.email}
                </a>
              </FieldRow>
            )}
            {client.phone && (
              <FieldRow icon={<Phone />} label="Phone">
                <a href={`tel:${client.phone}`} className="hover:underline">{client.phone}</a>
              </FieldRow>
            )}
            {client.website && (
              <FieldRow icon={<Globe />} label="Website">
                <a
                  href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {client.website.replace(/^https?:\/\//, '')}
                  <ArrowUpRight className="size-3" />
                </a>
              </FieldRow>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No contact details recorded.</p>
        )}
      </section>

      {/* Pipeline */}
      <section>
        <SectionHeading>Pipeline</SectionHeading>
        {hasPipeline ? (
          <dl className="flex flex-col gap-2.5">
            {client.estimatedValue != null && (
              <FieldRow icon={<DollarSign />} label="Est. value">
                <span className="font-medium">{formatCurrency(client.estimatedValue)}</span>
              </FieldRow>
            )}
            {client.industry && (
              <FieldRow icon={<Building2 />} label="Industry">{client.industry}</FieldRow>
            )}
            {client.companySize && (
              <FieldRow icon={<Users />} label="Company size">{client.companySize}</FieldRow>
            )}
            {client.leadSource && (
              <FieldRow icon={<ArrowUpRight />} label="Lead source">{client.leadSource}</FieldRow>
            )}
            {client.projectType && (
              <FieldRow icon={<Briefcase />} label="Project type">{client.projectType}</FieldRow>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No pipeline details recorded.</p>
        )}
      </section>

      {/* Follow-up */}
      <section>
        <SectionHeading>Follow-up</SectionHeading>
        <dl className="flex flex-col gap-2.5">
          <FieldRow icon={<Calendar />} label="Last contact">
            {formatDate(client.lastContactDate)}
          </FieldRow>
          <FieldRow icon={<CalendarCheck />} label="Next follow-up">
            <span className={cn(
              followupOverdue && client.nextFollowupDate
                ? 'font-medium text-amber-600 dark:text-amber-400'
                : '',
            )}>
              {formatDate(client.nextFollowupDate)}
            </span>
          </FieldRow>
        </dl>
      </section>

      {/* Tags */}
      {client.clientTags.length > 0 && (
        <section>
          <SectionHeading>Tags</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {client.clientTags.map(({ tag }) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium"
              >
                <Tag className="size-2.5 text-muted-foreground" />
                {tag.label}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Intelligence tab ───────────────────────────────────────────────────────

function IntelligenceTab({
  client,
  onEdit,
}: {
  client: SerializedClientDetail
  onEdit: () => void
}) {
  const hasData = !!(client.painPoints || client.requirements || client.opportunityNotes)

  if (!hasData) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Lightbulb className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No intelligence recorded</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add pain points, requirements, and opportunity notes to improve prompt quality.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil />
          Add intelligence
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-5">
      {client.painPoints && (
        <IntelSection title="Pain points" body={client.painPoints} />
      )}
      {client.requirements && (
        <IntelSection title="Requirements" body={client.requirements} />
      )}
      {client.opportunityNotes && (
        <IntelSection title="Opportunity notes" body={client.opportunityNotes} />
      )}
    </div>
  )
}

function IntelSection({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <SectionHeading>{title}</SectionHeading>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </section>
  )
}

// ── Placeholder tab ────────────────────────────────────────────────────────

function PlaceholderTab({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">{label} — coming soon</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  )
}

function FieldRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <dt className="flex w-28 shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
        <span className="[&_svg]:size-3.5 text-muted-foreground/70">{icon}</span>
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}
