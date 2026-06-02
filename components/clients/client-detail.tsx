'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode, FormEvent, ElementType } from 'react'
import {
  Mail, Phone, Globe, Building2, Users, ArrowUpRight,
  DollarSign, Briefcase, Calendar, CalendarCheck,
  Lightbulb, Tag, X, Pencil, Archive, RotateCcw, Loader2,
  FileText, PhoneCall, MessagesSquare, Send, Trash2,
  Plus, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/clients/status-badge'
import { cn } from '@/lib/utils'
import { CLIENT_STATUSES } from '@/lib/clients/types'
import { NOTE_TYPES, type NoteType } from '@/lib/notes/types'
import { TAG_COLOR_CLASSES, TAG_DOT_CLASSES } from '@/lib/tags/colors'
import { TAG_COLORS, type TagColor } from '@/lib/tags/validators'
import { changeClientStatusAction, setClientArchivedAction, updateClientAction } from '@/lib/actions/clients'
import { createNoteAction, deleteNoteAction } from '@/lib/actions/notes'
import { listTagsAction, attachTagAction, detachTagAction } from '@/lib/actions/tags'

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
  activities: Array<{
    id: string
    type: string
    detail: Record<string, unknown>
    createdAt: string
  }>
  customFields: Record<string, string>
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
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
        {activeTab === 'notes' && <NotesTab client={client} />}
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

// ── Notes tab ──────────────────────────────────────────────────────────────

function NotesTab({ client }: { client: SerializedClientDetail }) {
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

function OverviewTab({ client }: { client: SerializedClientDetail }) {
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

  const followupOverdue = isOverdue(client.nextFollowupDate)
  const hasContact = !!(client.email || client.phone || client.website)
  const hasPipeline = !!(
    client.estimatedValue != null ||
    client.industry || client.companySize ||
    client.leadSource || client.projectType
  )
  const customFieldEntries = Object.entries(customFields)

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
      const from = STATUS_LABELS[String(d.from)] ?? String(d.from)
      const to = STATUS_LABELS[String(d.to)] ?? String(d.to)
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
