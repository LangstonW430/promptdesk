'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode, FormEvent, ElementType } from 'react'
import {
  Mail, Phone, Globe, MapPin, Building2, Users, ArrowUpRight,
  DollarSign, Calendar, CalendarCheck,
  Lightbulb, Tag, X, Pencil, Archive, RotateCcw, Loader2,
  FileText, PhoneCall, MessagesSquare, Send, Trash2,
  Plus, Check,
  File, FileImage, FileSpreadsheet, Upload, Download,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StageBadge } from '@/components/clients/stage-badge'
import { cn } from '@/lib/utils'
import type { ClientStage } from '@/lib/clients/stage'
import { NOTE_TYPES, type NoteType } from '@/lib/notes/types'
import { TAG_COLOR_CLASSES } from '@/lib/tags/colors'
import type { TagColor } from '@/lib/tags/validators'
import { setClientArchivedAction, updateClientAction, deleteClientAction } from '@/lib/actions/clients'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { createNoteAction, deleteNoteAction } from '@/lib/actions/notes'
import { listTagsAction, attachTagAction, detachTagAction } from '@/lib/actions/tags'
import { requestSignedUrlAction, saveAttachmentAction, deleteAttachmentAction } from '@/lib/actions/attachments'
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES, BUCKET_NAME } from '@/lib/attachments/validators'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { ClientInsightPanel } from '@/components/prompts/client-insight-panel'
import { NoteAnalysisPanel } from '@/components/prompts/note-analysis-panel'
import { ClientEmailPanel } from '@/components/prompts/client-email-panel'

// ── Types ──────────────────────────────────────────────────────────────────

export type SerializedClientDetail = {
  id: string
  companyName: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  industry: string | null
  companySize: string | null
  leadSource: string | null
  /** Derived from this client's projects and contact history — see lib/clients/stage.ts. */
  stage: ClientStage
  /** Summed from the client's proposed + active projects. */
  pipelineValue: number
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
  attachments: Array<{
    id: string
    fileName: string
    mimeType: string | null
    sizeBytes: number | null
    /** Which of this client's projects the file is about; null when it is not about one. */
    projectId: string | null
    createdAt: string
  }>
  activities: Array<{
    id: string
    type: string
    detail: Record<string, unknown>
    createdAt: string
  }>
  projects: Array<{ id: string; title: string; status: string; budget?: number | null }>
  customFields: Record<string, string>
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Clients no longer carry a status, but activity rows recorded before it was
// removed still reference the old vocabulary — this keeps that history readable.
const LEGACY_STATUS_LABELS: Record<string, string> = {
  lead: 'Lead', contacted: 'Contacted', proposal_sent: 'Proposal sent',
  negotiating: 'Negotiating', won: 'Won', lost: 'Lost',
}

const NOTE_TYPE_CONFIG: Record<NoteType, { label: string; icon: ElementType; className: string }> = {
  note:    { label: 'Note',    icon: FileText,       className: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40' },
  call:    { label: 'Call',    icon: PhoneCall,      className: 'text-green-600 bg-green-50 dark:bg-green-950/40' },
  meeting: { label: 'Meeting', icon: MessagesSquare, className: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
  email:   { label: 'Email',   icon: Send,           className: 'text-orange-500 bg-orange-50 dark:bg-orange-950/40' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// Says what produced the stage, so a read-only badge does not look like a
// control someone broke.
// `lost` is deliberately absent: it means archived, and the Archived chip
// beside the badge already says so.
const STAGE_EXPLANATIONS: Partial<Record<ClientStage, string>> = {
  lead: 'No contact logged yet',
  contacted: 'Contact logged, nothing quoted',
  proposal_out: 'Has a proposed project',
  active: 'Has an active project',
  past: 'All projects completed',
}

// ── Tabs ───────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'notes' | 'intelligence' | 'attachments'

// ── Main component ─────────────────────────────────────────────────────────

interface ClientDetailProps {
  client: SerializedClientDetail
  defaultAi?: string | null
  onClose?: () => void
}

export function ClientDetail({ client, defaultAi, onClose }: ClientDetailProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const displayName = client.companyName ?? client.contactName ?? 'Unnamed client'

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'notes', label: 'Notes', count: client.notes.length || undefined },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'attachments', label: 'Attachments', count: client.attachments.length || undefined },
  ]

  function handleArchiveToggle() {
    startTransition(async () => {
      const result = await setClientArchivedAction(client.id, { archived: !client.isArchived })
      if (!('error' in result)) {
        router.refresh()
      }
    })
  }

  function handleDelete() {
    setDeleteOpen(false)
    startTransition(async () => {
      await deleteClientAction(client.id)
      router.push('/clients')
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
          {/* Read-only: the stage follows the client's projects rather than a
              field someone has to remember to update. */}
          <StageBadge stage={client.stage} />
          {STAGE_EXPLANATIONS[client.stage] && (
            <span className="text-xs text-muted-foreground">
              {STAGE_EXPLANATIONS[client.stage]}
            </span>
          )}
          {client.isArchived && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Archived
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { window.location.href = `/clients/${client.id}/edit` }}
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

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDeleteOpen(true)}
              disabled={isPending}
              aria-label="Delete client"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        {/* Tab nav */}
        <div role="tablist" aria-label="Client sections" className="flex px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`client-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`client-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
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
        <div role="tabpanel" id="client-panel-overview" aria-labelledby="client-tab-overview" tabIndex={0} hidden={activeTab !== 'overview'} className="focus-visible:outline-none">
          <OverviewTab client={client} defaultAi={defaultAi} />
        </div>
        <div role="tabpanel" id="client-panel-notes" aria-labelledby="client-tab-notes" tabIndex={0} hidden={activeTab !== 'notes'} className="focus-visible:outline-none">
          <NotesTab client={client} defaultAi={defaultAi} />
        </div>
        <div role="tabpanel" id="client-panel-intelligence" aria-labelledby="client-tab-intelligence" tabIndex={0} hidden={activeTab !== 'intelligence'} className="focus-visible:outline-none">
          <IntelligenceTab client={client} onEdit={() => { window.location.href = `/clients/${client.id}/edit` }} />
        </div>
        <div role="tabpanel" id="client-panel-attachments" aria-labelledby="client-tab-attachments" tabIndex={0} hidden={activeTab !== 'attachments'} className="focus-visible:outline-none">
          <AttachmentsTab client={client} />
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete client?"
        description={`This will permanently delete ${client.companyName ?? client.contactName ?? 'this client'} and all their notes, tasks, and attachments. This cannot be undone.`}
        confirmLabel="Delete permanently"
        variant="destructive"
        onConfirm={handleDelete}
        isPending={isPending}
      />
    </div>
  )
}

// ── Notes tab ──────────────────────────────────────────────────────────────

function NotesTab({ client, defaultAi }: { client: SerializedClientDetail; defaultAi?: string | null }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [noteType, setNoteType] = useState<NoteType>('note')
  const [occurredAt, setOccurredAt] = useState(todayISO())
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setFormError(null)
    startTransition(async () => {
      const result = await createNoteAction(client.id, {
        body: body.trim(),
        noteType,
        occurredAt,
      })
      if ('error' in result) {
        setFormError(result.error ?? null)
        return
      }
      setBody('')
      setNoteType('note')
      setOccurredAt(todayISO())
      router.refresh()
    })
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      await deleteNoteAction(noteId, client.id)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Note Analysis prompt generator */}
      <NoteAnalysisPanel
        clientId={client.id}
        noteCount={client.notes.length}
        defaultAi={defaultAi}
      />

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note, log a call, or record a meeting…"
          rows={3}
          disabled={isPending}
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Type select */}
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value as NoteType)}
            disabled={isPending}
            aria-label="Note type"
            className="h-7 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {NOTE_TYPES.map((t) => (
              <option key={t} value={t}>{NOTE_TYPE_CONFIG[t].label}</option>
            ))}
          </select>

          {/* Occurred at */}
          <input
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            disabled={isPending}
            aria-label="Date of note"
            className="h-7 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          />

          <Button type="submit" size="sm" disabled={isPending || !body.trim()} className="ml-auto">
            {isPending ? <Loader2 className="animate-spin" /> : null}
            Add note
          </Button>
        </div>

        {formError && (
          <p className="text-xs text-destructive">{formError}</p>
        )}
      </form>

      {/* Note list */}
      {client.notes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No notes yet. Add the first one above.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {client.notes.map((note) => {
            const config = NOTE_TYPE_CONFIG[note.noteType as NoteType] ?? NOTE_TYPE_CONFIG.note
            const Icon = config.icon
            return (
              <li
                key={note.id}
                className="group flex gap-3 rounded-xl border border-border bg-card p-4"
              >
                {/* Type icon */}
                <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px]', config.className)}>
                  <Icon className="size-3.5" />
                </span>

                {/* Body + meta */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-xs font-medium">{config.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(note.occurredAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.body}</p>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(note.id)}
                  disabled={isPending}
                  aria-label="Delete note"
                  className="mt-0.5 shrink-0 self-start rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Overview tab ───────────────────────────────────────────────────────────

type PickerTag = { id: string; label: string; color: string | null }

function OverviewTab({ client, defaultAi }: { client: SerializedClientDetail; defaultAi?: string | null }) {
  const router = useRouter()

  // ── Tag picker ─────────────────────────────────────────────────────────
  const [attachedTagIds, setAttachedTagIds] = useState(
    () => new Set(client.clientTags.map((ct) => ct.tag.id)),
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [allTags, setAllTags] = useState<PickerTag[] | null>(null)
  const [loadingTags, setLoadingTags] = useState(false)
  const [, startTagTransition] = useTransition()
  const pickerRef = useRef<HTMLDivElement>(null)

  // ── Follow-up dates ────────────────────────────────────────────────────────
  const [localLastContact, setLocalLastContact] = useState(
    () => client.lastContactDate?.slice(0, 10) ?? '',
  )
  const [localNextFollowup, setLocalNextFollowup] = useState(
    () => client.nextFollowupDate?.slice(0, 10) ?? '',
  )
  const [, startDateTransition] = useTransition()

  // ── Custom fields ──────────────────────────────────────────────────────
  const [customFields, setCustomFields] = useState<Record<string, string>>(
    () => (client.customFields ?? {}) as Record<string, string>,
  )
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingVal, setEditingVal] = useState('')
  const [addingField, setAddingField] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')
  const [, startCfTransition] = useTransition()

  // Sync from server props
  useEffect(() => {
    setAttachedTagIds(new Set(client.clientTags.map((ct) => ct.tag.id)))
  }, [client.clientTags])

  useEffect(() => {
    setLocalLastContact(client.lastContactDate?.slice(0, 10) ?? '')
    setLocalNextFollowup(client.nextFollowupDate?.slice(0, 10) ?? '')
  }, [client.lastContactDate, client.nextFollowupDate])

  useEffect(() => {
    setCustomFields((client.customFields ?? {}) as Record<string, string>)
  }, [client.customFields])

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  async function handleOpenPicker() {
    setPickerOpen(true)
    if (!allTags) {
      setLoadingTags(true)
      const result = await listTagsAction()
      setAllTags(result.tags)
      setLoadingTags(false)
    }
  }

  function handleTagToggle(tagId: string) {
    const isAttached = attachedTagIds.has(tagId)
    const snapshot = new Set(attachedTagIds)
    setAttachedTagIds((prev) => {
      const next = new Set(prev)
      if (isAttached) next.delete(tagId)
      else next.add(tagId)
      return next
    })
    startTagTransition(async () => {
      const result = isAttached
        ? await detachTagAction(client.id, tagId)
        : await attachTagAction(client.id, tagId)
      if ('error' in result) setAttachedTagIds(snapshot)
      else router.refresh()
    })
  }

  function handleFollowupDateChange(field: 'lastContactDate' | 'nextFollowupDate', value: string) {
    if (field === 'lastContactDate') setLocalLastContact(value)
    else setLocalNextFollowup(value)
    startDateTransition(async () => {
      await updateClientAction(client.id, { [field]: value })
      router.refresh()
    })
  }

  function saveCustomFields(updated: Record<string, string>) {
    const snapshot = { ...customFields }
    setCustomFields(updated)
    startCfTransition(async () => {
      const result = await updateClientAction(client.id, { customFields: updated })
      if ('error' in result) setCustomFields(snapshot)
      else router.refresh()
    })
  }

  function commitFieldEdit() {
    if (!editingKey) return
    saveCustomFields({ ...customFields, [editingKey]: editingVal })
    setEditingKey(null)
  }

  function deleteField(key: string) {
    const updated = Object.fromEntries(
      Object.entries(customFields).filter(([k]) => k !== key),
    )
    saveCustomFields(updated)
  }

  function addField() {
    const k = newKey.trim()
    const v = newVal.trim()
    if (!k || !v) return
    saveCustomFields({ ...customFields, [k]: v })
    setAddingField(false)
    setNewKey('')
    setNewVal('')
  }

  const followupOverdue = isOverdue(localNextFollowup || null)
  const hasContact = !!(client.email || client.phone || client.website || client.address)
  const hasPipeline = !!(
    client.pipelineValue > 0 ||
    client.industry || client.companySize ||
    client.leadSource
  )
  const customFieldEntries = Object.entries(customFields)
  const openProjectCount = client.projects.filter(
    (p) => p.status === 'proposed' || p.status === 'active',
  ).length

  // Derive displayed tag chips: use allTags when loaded for optimistic accuracy
  const displayedTags: PickerTag[] = allTags
    ? allTags.filter((t) => attachedTagIds.has(t.id))
    : client.clientTags
        .filter((ct) => attachedTagIds.has(ct.tag.id))
        .map((ct) => ct.tag)

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
            {client.address && (
              <FieldRow icon={<MapPin />} label="Billing address">
                <span className="whitespace-pre-wrap">{client.address}</span>
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
            {client.pipelineValue > 0 && (
              <FieldRow icon={<DollarSign />} label="Open value">
                <span className="font-medium">{formatCurrency(client.pipelineValue)}</span>
                {/* Read-only: the number is the sum of this client's proposed
                    and active project budgets, so it is edited on the projects
                    themselves rather than here. */}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  across {openProjectCount} {openProjectCount === 1 ? 'project' : 'projects'}
                </span>
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
            <input
              type="date"
              value={localLastContact}
              onChange={(e) => handleFollowupDateChange('lastContactDate', e.target.value)}
              className="h-7 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </FieldRow>
          <FieldRow icon={<CalendarCheck />} label="Next follow-up">
            <input
              type="date"
              value={localNextFollowup}
              onChange={(e) => handleFollowupDateChange('nextFollowupDate', e.target.value)}
              className={cn(
                'h-7 rounded-lg border border-input bg-background px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
                followupOverdue && localNextFollowup
                  ? 'font-medium text-amber-600 dark:text-amber-400'
                  : 'text-foreground',
              )}
            />
          </FieldRow>
        </dl>
      </section>

      {/* ── Tags ──────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tags
          </h3>
          <div className="relative" ref={pickerRef}>
            <button
              onClick={handleOpenPicker}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Tag className="size-3" />
              Edit tags
            </button>

            {/* Tag picker dropdown */}
            {pickerOpen && (
              <div className="absolute right-0 top-7 z-20 w-56 rounded-xl border border-border bg-popover shadow-lg">
                <div className="border-b border-border px-3 py-2">
                  <p className="text-xs font-medium">Attach tags</p>
                </div>
                <div className="max-h-52 overflow-y-auto p-1">
                  {loadingTags ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : !allTags || allTags.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground">
                      No tags yet. Create some in Settings.
                    </p>
                  ) : (
                    allTags.map((tag) => {
                      const checked = attachedTagIds.has(tag.id)
                      return (
                        <button
                          key={tag.id}
                          onClick={() => handleTagToggle(tag.id)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                        >
                          <span
                            className={cn(
                              'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                              checked
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input',
                            )}
                          >
                            {checked && <Check className="size-2.5" />}
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              TAG_COLOR_CLASSES[(tag.color ?? 'gray') as TagColor],
                            )}
                          >
                            {tag.label}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
                <div className="border-t border-border px-3 py-2">
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {displayedTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags attached.</p>
          ) : (
            displayedTags.map((tag) => (
              <span
                key={tag.id}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  TAG_COLOR_CLASSES[(tag.color ?? 'gray') as TagColor],
                )}
              >
                {tag.label}
              </span>
            ))
          )}
        </div>
      </section>

      {/* ── Custom fields ──────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Custom fields
          </h3>
          {!addingField && (
            <button
              onClick={() => setAddingField(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="size-3" />
              Add field
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {customFieldEntries.map(([key, value]) => (
            <div key={key} className="group flex items-start gap-3">
              <dt className="w-28 shrink-0 pt-0.5 text-sm text-muted-foreground leading-snug">
                {key}
              </dt>
              {editingKey === key ? (
                <dd className="flex flex-1 items-center gap-1.5">
                  <input
                    value={editingVal}
                    onChange={(e) => setEditingVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitFieldEdit()
                      if (e.key === 'Escape') setEditingKey(null)
                    }}
                    autoFocus
                    className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
                  />
                  <button
                    onClick={commitFieldEdit}
                    aria-label="Save"
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingKey(null)}
                    aria-label="Cancel"
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </dd>
              ) : (
                <dd className="flex flex-1 items-center justify-between gap-2">
                  <span className="text-sm">{value}</span>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => { setEditingKey(key); setEditingVal(value) }}
                      aria-label={`Edit ${key}`}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      onClick={() => deleteField(key)}
                      aria-label={`Delete ${key}`}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </dd>
              )}
            </div>
          ))}

          {customFieldEntries.length === 0 && !addingField && (
            <p className="text-sm text-muted-foreground">No custom fields yet.</p>
          )}

          {/* Add field inline form */}
          {addingField && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Field name"
                autoFocus
                className="w-28 shrink-0 rounded border border-input bg-background px-2 py-0.5 text-sm outline-none focus:border-ring"
              />
              <input
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                placeholder="Value"
                onKeyDown={(e) => { if (e.key === 'Enter') addField() }}
                className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-sm outline-none focus:border-ring"
              />
              <button
                onClick={addField}
                aria-label="Save field"
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <Check className="size-3.5" />
              </button>
              <button
                onClick={() => { setAddingField(false); setNewKey(''); setNewVal('') }}
                aria-label="Cancel"
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* AI Insight */}
      <section>
        <SectionHeading>AI Insight</SectionHeading>
        <ClientInsightPanel clientId={client.id} defaultAi={defaultAi} />
      </section>

      {/* Email drafts */}
      <section>
        <SectionHeading>Email Drafts</SectionHeading>
        <ClientEmailPanel
          clientId={client.id}
          clientEmail={client.email}
          defaultAi={defaultAi}
        />
      </section>

      {/* Activity timeline */}
      {client.activities.length > 0 && (
        <section>
          <SectionHeading>Recent activity</SectionHeading>
          <ActivityTimeline activities={client.activities} />
        </section>
      )}
    </div>
  )
}

// ── Activity timeline ──────────────────────────────────────────────────────

type Activity = SerializedClientDetail['activities'][number]

function activityDescription(activity: Activity): string {
  const d = activity.detail
  switch (activity.type) {
    case 'status_changed': {
      const from = LEGACY_STATUS_LABELS[String(d.from)] ?? String(d.from)
      const to = LEGACY_STATUS_LABELS[String(d.to)] ?? String(d.to)
      return `Status: ${from} → ${to}`
    }
    case 'note_added': {
      const type = NOTE_TYPE_CONFIG[String(d.noteType) as NoteType]?.label ?? 'Note'
      return `${type} logged`
    }
    default:
      return activity.type.replace(/_/g, ' ')
  }
}

function activityDotClass(type: string): string {
  switch (type) {
    case 'status_changed': return 'bg-blue-500'
    case 'note_added':     return 'bg-green-500'
    default:               return 'bg-muted-foreground/40'
  }
}

function ActivityTimeline({ activities }: { activities: Activity[] }) {
  return (
    <ul className="flex flex-col gap-0">
      {activities.map((activity, i) => (
        <li key={activity.id} className="flex items-start gap-3">
          {/* Dot + line */}
          <div className="flex flex-col items-center">
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', activityDotClass(activity.type))} />
            {i < activities.length - 1 && (
              <span className="mt-1 w-px flex-1 bg-border" style={{ minHeight: '16px' }} />
            )}
          </div>

          {/* Text */}
          <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 pb-3">
            <p className="text-sm leading-tight">{activityDescription(activity)}</p>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {timeAgo(activity.createdAt)}
            </span>
          </div>
        </li>
      ))}
    </ul>
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

// ── Attachments tab ───────────────────────────────────────────────────────

type SerializedAttachment = SerializedClientDetail['attachments'][number]

function formatBytes(n: number | null): string {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string | null }): React.ReactElement {
  if (mimeType?.startsWith('image/')) return <FileImage className="size-4 shrink-0 text-blue-500" />
  if (mimeType === 'application/pdf') return <FileText className="size-4 shrink-0 text-red-500" />
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel') || mimeType === 'text/csv')
    return <FileSpreadsheet className="size-4 shrink-0 text-green-600" />
  if (mimeType?.includes('word') || mimeType === 'text/plain')
    return <FileText className="size-4 shrink-0 text-blue-600" />
  return <File className="size-4 shrink-0 text-muted-foreground" />
}

function AttachmentsTab({ client }: { client: SerializedClientDetail }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // Chosen before picking the file, so one selection covers the whole upload.
  // '' means the file is about the client rather than one piece of work.
  const [projectId, setProjectId] = useState('')

  const projectTitles = new Map(client.projects.map((p) => [p.id, p.title]))

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Always reset the input so the same file can be re-selected after an error
    e.target.value = ''
    if (!file) return

    // Client-side validation
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File too large — maximum size is 10 MB.')
      return
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setUploadError('File type not allowed. Accepted: images, PDF, Word, Excel, CSV, plain text.')
      return
    }

    setUploadError(null)
    setUploading(true)

    try {
      // 1. Get a signed upload URL from the server
      const urlResult = await requestSignedUrlAction(client.id, {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      })
      if ('error' in urlResult) {
        setUploadError(urlResult.error ?? 'Failed to get upload URL')
        return
      }

      // 2. Upload directly to Supabase Storage (browser → storage, no server bandwidth)
      const supabase = createSupabaseClient()
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET_NAME)
        .uploadToSignedUrl(urlResult.storageKey, urlResult.token, file, {
          contentType: file.type,
        })
      if (uploadErr) {
        setUploadError(uploadErr.message ?? 'Upload failed')
        return
      }

      // 3. Save metadata
      const saveResult = await saveAttachmentAction(client.id, {
        projectId: projectId || null,
        storageKey: urlResult.storageKey,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      })
      if ('error' in saveResult) {
        setUploadError(saveResult.error ?? 'Failed to save attachment')
        return
      }

      router.refresh()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleDelete(attachmentId: string) {
    startTransition(async () => {
      await deleteAttachmentAction(attachmentId, client.id)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={[...ALLOWED_MIME_TYPES].join(',')}
        onChange={handleFileChange}
        className="sr-only"
        aria-hidden
      />

      {/* Upload controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || isPending}
        >
          {uploading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Upload />
          )}
          {uploading ? 'Uploading…' : 'Attach file'}
        </Button>

        {/* Only when there is work to attach to. */}
        {client.projects.length > 0 && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={uploading || isPending}
            aria-label="Attach to project"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <option value="">No project — about the client</option>
            {client.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        )}

        <p className="text-xs text-muted-foreground">
          Max 10 MB · Images, PDF, Word, Excel, CSV, text
        </p>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Attachment list */}
      {client.attachments.length === 0 && !uploading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No attachments yet. Click <strong>Attach file</strong> to add a proposal, contract, or screenshot.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {client.attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              // `client.projects` excludes archived and cancelled work, so a
              // file attached to one would otherwise read as unattributed.
              projectTitle={
                attachment.projectId
                  ? (projectTitles.get(attachment.projectId) ?? 'Archived project')
                  : null
              }
              isPending={isPending}
              onDelete={() => handleDelete(attachment.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function AttachmentRow({
  attachment,
  projectTitle,
  isPending,
  onDelete,
}: {
  attachment: SerializedAttachment
  projectTitle: string | null
  isPending: boolean
  onDelete: () => void
}) {
  return (
    <li className="group flex items-center gap-3 px-4 py-3">
      <FileIcon mimeType={attachment.mimeType} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{attachment.fileName}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {attachment.sizeBytes != null && <span>{formatBytes(attachment.sizeBytes)}</span>}
          {projectTitle && (
            <span className="rounded bg-muted px-1.5 py-px text-[11px] font-medium">
              {projectTitle}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {/* Download */}
        <a
          href={`/api/attachments/${attachment.id}/download`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Download ${attachment.fileName}`}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Download className="size-4" />
        </a>

        {/* Delete */}
        <button
          onClick={onDelete}
          disabled={isPending}
          aria-label={`Delete ${attachment.fileName}`}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
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
