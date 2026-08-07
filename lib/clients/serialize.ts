import type { SerializedClientDetail } from '@/components/clients/client-detail'
import { PIPELINE_PROJECT_STATUSES } from './pipeline-value'
import type { ClientStage } from './stage'

type DecimalLike = { toNumber(): number } | number | null | undefined

function toNum(d: DecimalLike): number | null {
  if (d == null) return null
  if (typeof d === 'number') return d
  return d.toNumber()
}

type ClientWithRelations = {
  id: string
  companyName: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
  industry: string | null
  companySize: string | null
  leadSource: string | null
  defaultRate: DecimalLike
  projectType: string | null
  painPoints: string | null
  requirements: string | null
  opportunityNotes: string | null
  lastContactDate: Date | null
  nextFollowupDate: Date | null
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  clientTags: Array<{ tag: { id: string; label: string; color: string | null } }>
  notes: Array<{ id: string; body: string; noteType: string; occurredAt: Date }>
  attachments: Array<{
    id: string
    fileName: string
    mimeType: string | null
    sizeBytes: bigint | null
    createdAt: Date
  }>
  activities: Array<{
    id: string
    type: string
    detail: unknown
    createdAt: Date
  }>
  projects: Array<{ id: string; title: string; status: string; budget?: DecimalLike }>
  customFields: unknown
}

/**
 * `stage` is passed in rather than computed here: it is derived from projects
 * and notes by one rule (lib/clients/stage.ts), fed by one query
 * (lib/clients/stage-query.ts), and re-deriving it from this page's already
 * filtered relations would quietly disagree with the list and the dashboard.
 */
export function serializeClientDetail(
  client: ClientWithRelations,
  stage: ClientStage,
): SerializedClientDetail {
  return {
    stage,
    id: client.id,
    companyName: client.companyName,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    website: client.website,
    industry: client.industry,
    companySize: client.companySize,
    leadSource: client.leadSource,
    defaultRate: toNum(client.defaultRate),
    projectType: client.projectType,
    painPoints: client.painPoints,
    requirements: client.requirements,
    opportunityNotes: client.opportunityNotes,
    lastContactDate: client.lastContactDate?.toISOString() ?? null,
    nextFollowupDate: client.nextFollowupDate?.toISOString() ?? null,
    isArchived: client.isArchived,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    clientTags: client.clientTags.map((ct) => ({
      tag: { id: ct.tag.id, label: ct.tag.label, color: ct.tag.color },
    })),
    notes: client.notes.map((n) => ({
      id: n.id,
      body: n.body,
      noteType: n.noteType,
      occurredAt: n.occurredAt.toISOString(),
    })),
    attachments: client.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes != null ? Number(a.sizeBytes) : null,
      createdAt: a.createdAt.toISOString(),
    })),
    activities: client.activities.map((a) => ({
      id: a.id,
      type: a.type,
      detail: a.detail as Record<string, unknown>,
      createdAt: a.createdAt.toISOString(),
    })),
    projects: client.projects.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      budget: toNum(p.budget),
    })),
    // Summed here rather than carried on the client row: value lives on
    // projects now, and the detail page already has them loaded.
    pipelineValue: client.projects.reduce(
      (sum, p) =>
        PIPELINE_PROJECT_STATUSES.includes(p.status as 'proposed' | 'active')
          ? sum + (toNum(p.budget) ?? 0)
          : sum,
      0,
    ),
    customFields: (client.customFields ?? {}) as Record<string, string>,
  }
}
