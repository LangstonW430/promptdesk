import type { SerializedClientDetail } from '@/components/clients/client-detail'

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
  status: string
  estimatedValue: DecimalLike
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
  tasks: Array<{ id: string; title: string; dueDate: Date | null; isDone: boolean }>
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
  projects: Array<{ id: string; title: string; status: string }>
  timeEntries: Array<{
    id: string
    projectId: string | null
    date: Date
    hours: DecimalLike
    rate: DecimalLike
    description: string | null
    isBillable: boolean
    project: { title: string } | null
  }>
  customFields: unknown
}

export function serializeClientDetail(client: ClientWithRelations): SerializedClientDetail {
  return {
    id: client.id,
    companyName: client.companyName,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    website: client.website,
    industry: client.industry,
    companySize: client.companySize,
    leadSource: client.leadSource,
    status: client.status,
    estimatedValue: toNum(client.estimatedValue),
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
    tasks: client.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate?.toISOString() ?? null,
      isDone: t.isDone,
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
    })),
    timeEntries: client.timeEntries.map((e) => ({
      id: e.id,
      projectId:    e.projectId,
      projectTitle: e.project?.title ?? null,
      date:         e.date.toISOString().slice(0, 10),
      hours:        toNum(e.hours) ?? 0,
      rate:         toNum(e.rate),
      description:  e.description,
      isBillable:   e.isBillable,
    })),
    customFields: (client.customFields ?? {}) as Record<string, string>,
  }
}
