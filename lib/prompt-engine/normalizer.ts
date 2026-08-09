import type {
  EngineClient,
  EngineNote,
  EngineTask,
  EngineActivity,
  EngineProject,
  ClientStage,
  NoteType,
  ProjectStatus,
  NormalizerOptions,
  RawClient,
  RawNote,
  RawTask,
  RawActivity,
  RawProject,
} from './types'
import { CLIENT_STAGES } from '@/lib/clients/stage'

// ─── Hashing ──────────────────────────────────────────────────────────────────

/** djb2 hash — no dependencies, sufficient for content deduplication. */
function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

function normaliseForHash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function contentHash(body: string): string {
  return djb2(normaliseForHash(body))
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null
  return value instanceof Date ? value : new Date(value)
}

function formatDate(value: Date | string | null | undefined, locale: string): string | null {
  const d = toDate(value)
  if (!d || isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

function toIso(value: Date | string | null | undefined): string | null {
  const d = toDate(value)
  if (!d || isNaN(d.getTime())) return null
  return d.toISOString()
}

function toNumber(
  value: number | { toNumber(): number } | null | undefined,
): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  return null
}

function formatCurrency(
  amount: number | null,
  currency: string,
  locale: string,
): string | null {
  if (amount == null) return null
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

const VALID_STAGES = new Set<ClientStage>(CLIENT_STAGES)

function toClientStage(raw: string): ClientStage {
  return VALID_STAGES.has(raw as ClientStage) ? (raw as ClientStage) : 'lead'
}

const VALID_NOTE_TYPES = new Set<NoteType>(['note', 'call', 'meeting', 'email'])

function toNoteType(raw: string): NoteType {
  return VALID_NOTE_TYPES.has(raw as NoteType) ? (raw as NoteType) : 'note'
}

const VALID_PROJECT_STATUSES = new Set<ProjectStatus>([
  'proposed', 'active', 'completed', 'on_hold', 'cancelled',
])

function toProjectStatus(raw: string): ProjectStatus {
  return VALID_PROJECT_STATUSES.has(raw as ProjectStatus) ? (raw as ProjectStatus) : 'active'
}

// ─── Public normalizers ───────────────────────────────────────────────────────

export function normalizeClient(raw: RawClient, opts: NormalizerOptions = {}): EngineClient {
  const currency = opts.currency ?? 'USD'
  const locale = opts.locale ?? 'en-US'
  const value = toNumber(raw.estimatedValue)

  const tags = Array.isArray(raw.tags) ? (raw.tags as string[]) : []
  const customFields: Record<string, string> = {}
  if (raw.customFields && typeof raw.customFields === 'object') {
    for (const [k, v] of Object.entries(raw.customFields)) {
      if (typeof v === 'string') customFields[k] = v
      else if (v != null) customFields[k] = String(v)
    }
  }

  return {
    id: raw.id,
    companyName: raw.companyName ?? null,
    contactName: raw.contactName ?? null,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    website: raw.website ?? null,
    industry: raw.industry ?? null,
    companySize: raw.companySize ?? null,
    leadSource: raw.leadSource ?? null,
    stage: toClientStage(raw.stage),
    estimatedValue: value,
    estimatedValueFormatted: formatCurrency(value, currency, locale),
    projects: (raw.projects ?? []).map((p) => ({
      title: p.title,
      status: toProjectStatus(p.status),
      budgetFormatted: formatCurrency(toNumber(p.budget), currency, locale),
    })),
    painPoints: raw.painPoints ?? null,
    requirements: raw.requirements ?? null,
    opportunityNotes: raw.opportunityNotes ?? null,
    lastContactDate: formatDate(raw.lastContactDate, locale),
    nextFollowupDate: formatDate(raw.nextFollowupDate, locale),
    tags,
    customFields,
    createdAt: toIso(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(raw.updatedAt) ?? new Date(0).toISOString(),
    relationshipSummary: raw.relationshipSummary ?? null,
  }
}

export function normalizeNote(raw: RawNote): EngineNote {
  return {
    id: raw.id,
    clientId: raw.clientId,
    body: raw.body,
    noteType: toNoteType(raw.noteType),
    occurredAt: toIso(raw.occurredAt) ?? new Date(0).toISOString(),
    contentHash: contentHash(raw.body),
  }
}

export function normalizeTask(raw: RawTask): EngineTask {
  const locale = 'en-US'
  return {
    id: raw.id,
    clientId: raw.clientId ?? null,
    projectId: raw.projectId ?? null,
    title: raw.title,
    dueDate: formatDate(raw.dueDate, locale),
    isDone: raw.isDone,
  }
}

export function normalizeProject(raw: RawProject, opts: NormalizerOptions = {}): EngineProject {
  const currency = opts.currency ?? 'USD'
  const locale = opts.locale ?? 'en-US'
  const budgetNum = toNumber(raw.budget)

  const deliverables = Array.isArray(raw.deliverables)
    ? raw.deliverables.filter((d): d is string => typeof d === 'string')
    : []

  return {
    id: raw.id,
    clientId: raw.clientId,
    title: raw.title,
    status: toProjectStatus(raw.status),
    startDate: formatDate(raw.startDate, locale),
    endDate: formatDate(raw.endDate, locale),
    budget: budgetNum,
    budgetFormatted: formatCurrency(budgetNum, currency, locale),
    deliverables,
    createdAt: toIso(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(raw.updatedAt) ?? new Date(0).toISOString(),
  }
}

export function normalizeActivity(raw: RawActivity): EngineActivity {
  return {
    id: raw.id,
    clientId: raw.clientId ?? null,
    type: raw.type,
    detail: raw.detail ?? {},
    occurredAt: toIso(raw.createdAt) ?? new Date(0).toISOString(),
  }
}
