import type { SerializedClientDetail } from '@/components/clients/client-detail'

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
  estimatedValue: { toNumber?: () => number; toString?: () => string } | number | null
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
    estimatedValue: client.estimatedValue != null ? Number(client.estimatedValue) : null,
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
  }
}
