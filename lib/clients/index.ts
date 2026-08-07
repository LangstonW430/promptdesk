import type { Prisma } from '@/lib/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { buildClientWhere } from './filters'
import { pipelineValueByClient } from './pipeline-value'
import { clientStagesFor } from './stage-query'
import { OPEN_STAGES } from './stage'
import type { ClientFilters } from './types'
import type { CreateClientInput, UpdateClientInput } from './validators'

// Child collections are capped so a long-lived client's detail page does not
// degrade linearly with its history. `activities` was already bounded; the
// rest were not.
const withRelations = {
  notes:       { orderBy: { occurredAt: 'desc' as const }, take: 50 },
  attachments: { orderBy: { createdAt: 'desc' as const }, take: 50 },
  clientTags:  { include: { tag: true } },
  activities:  { orderBy: { createdAt: 'desc' as const }, take: 20 },
  projects:    { where: { status: { not: 'cancelled' }, isArchived: false }, orderBy: { updatedAt: 'desc' as const }, take: 50 },
}

export async function createClient(ownerId: string, input: CreateClientInput) {
  return prisma.client.create({
    data: {
      ownerId,
      ...input,
      lastContactDate: input.lastContactDate ? new Date(input.lastContactDate) : null,
      nextFollowupDate: input.nextFollowupDate ? new Date(input.nextFollowupDate) : null,
      customFields: (input.customFields ?? {}) as unknown as Prisma.InputJsonValue,
    },
  })
}

export async function getClientById(ownerId: string, id: string) {
  return prisma.client.findFirst({
    where: { id, ownerId },
    include: withRelations,
  })
}

/**
 * Full client rows for the REST surface (`GET /api/clients`), which documents
 * every column as part of its response contract.
 *
 * In-app callers should prefer the narrower queries below: this one selects
 * every column, including the long free-text intelligence fields
 * (`painPoints`, `requirements`, `opportunityNotes`, `relationshipSummary`)
 * that no list view renders.
 */
export async function listClients(ownerId: string, filters: ClientFilters = {}) {
  return prisma.client.findMany({
    where: buildClientWhere(ownerId, filters),
    include: { clientTags: { include: { tag: true } } },
    orderBy: { updatedAt: 'desc' },
  })
}

// Exactly the columns /clients renders (table + kanban). The page previously
// went through listClients, which fetches every column of every client — the
// intelligence free-text fields are unbounded in length and were being pulled
// over the wire on every load only to be dropped during serialisation. The tag
// join is narrowed for the same reason: the rows carry a full Tag each
// (ownerId, color, createdAt) where the UI reads only id and label.
const CLIENT_TABLE_SELECT = {
  id: true,
  companyName: true,
  contactName: true,
  email: true,
  industry: true,
  lastContactDate: true,
  nextFollowupDate: true,
  clientTags: { select: { tag: { select: { id: true, label: true } } } },
} as const

/**
 * Rows for /clients, each carrying the pipeline value derived from its open
 * projects.
 *
 * The value is a second grouped query rather than a relation aggregate on the
 * client rows: Prisma cannot sum a relation's column inside a `select`, and
 * including the projects themselves would pull every project of every client
 * across the wire to add up one number each.
 */
export async function listClientsForTable(
  ownerId: string,
  filters: ClientFilters = {},
) {
  const rows = await prisma.client.findMany({
    where: buildClientWhere(ownerId, filters),
    select: CLIENT_TABLE_SELECT,
    orderBy: { updatedAt: 'desc' },
  })

  const ids = rows.map((r) => r.id)
  const [values, stages] = await Promise.all([
    pipelineValueByClient(ownerId, ids),
    clientStagesFor(ownerId, ids),
  ])

  const withStage = rows.map((r) => ({
    ...r,
    pipelineValue: values.get(r.id) ?? null,
    stage: stages.get(r.id) ?? ('lead' as const),
  }))

  // Filtered here rather than in the query: a stage is a rule over projects and
  // notes, not a column, so it cannot be a WHERE clause.
  let result = withStage
  if (filters.stage) {
    result = result.filter((r) => r.stage === filters.stage)
  }
  // "Going cold" is about relationships still worth chasing. A client whose
  // work is finished has not gone cold — there is nothing outstanding to have
  // gone quiet on. (Archived clients are already excluded by the query.)
  if (filters.stale != null && filters.stale > 0) {
    result = result.filter((r) => OPEN_STAGES.includes(r.stage))
  }
  return result
}

/**
 * Id + display name only, for the client `<select>` pickers on the project,
 * invoice and finance forms. Sorted the way the pickers render them.
 *
 * Callers used to reach for either `listClients` (full rows, plus the tag
 * join, to read two columns) or one of two byte-identical local
 * `fetchClientsForPicker` copies.
 */
export async function listClientOptions(
  ownerId: string,
): Promise<Array<{ id: string; name: string }>> {
  const rows = await prisma.client.findMany({
    where: { ownerId, isArchived: false },
    select: { id: true, companyName: true, contactName: true },
    orderBy: [{ companyName: 'asc' }, { contactName: 'asc' }],
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.companyName ?? r.contactName ?? 'Unknown',
  }))
}

export async function updateClient(
  ownerId: string,
  id: string,
  input: UpdateClientInput,
) {
  const exists = await prisma.client.count({ where: { id, ownerId } })
  if (!exists) return null

  const { customFields, lastContactDate, nextFollowupDate, ...rest } = input

  const updated = await prisma.client.update({
    where: { id },
    data: {
      ...rest,
      ...(lastContactDate !== undefined && {
        lastContactDate: lastContactDate ? new Date(lastContactDate) : null,
      }),
      ...(nextFollowupDate !== undefined && {
        nextFollowupDate: nextFollowupDate ? new Date(nextFollowupDate) : null,
      }),
      ...(customFields !== undefined && {
        customFields: customFields as unknown as Prisma.InputJsonValue,
      }),
    },
  })

  return updated
}

export async function setClientArchived(
  ownerId: string,
  id: string,
  archived: boolean,
) {
  const exists = await prisma.client.count({ where: { id, ownerId } })
  if (!exists) return null

  return prisma.client.update({
    where: { id },
    data: { isArchived: archived },
  })
}

export async function deleteClient(ownerId: string, id: string): Promise<boolean> {
  const result = await prisma.client.deleteMany({ where: { id, ownerId } })
  return result.count > 0
}

// changeClientStatus was removed along with the column. Moving a client along
// is now a consequence of the work: quote them (a proposed project), start it
// (active), finish it (completed), or archive them. See lib/clients/stage.ts.
