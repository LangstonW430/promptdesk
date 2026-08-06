import type { Prisma } from '@/lib/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { refreshClientSummary } from '@/lib/relationship-summary/refresh'
import { buildClientWhere } from './filters'
import type { ClientFilters, ClientStatus } from './types'
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
      estimatedValue: input.estimatedValue ?? null,
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
  status: true,
  estimatedValue: true,
  lastContactDate: true,
  nextFollowupDate: true,
  clientTags: { select: { tag: { select: { id: true, label: true } } } },
} as const

export async function listClientsForTable(
  ownerId: string,
  filters: ClientFilters = {},
) {
  return prisma.client.findMany({
    where: buildClientWhere(ownerId, filters),
    select: CLIENT_TABLE_SELECT,
    orderBy: { updatedAt: 'desc' },
  })
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
  const current = await prisma.client.findFirst({
    where: { id, ownerId },
    select: { status: true },
  })
  if (!current) return null

  // Extract status so it never silently lands in ...rest and bypasses logging.
  const { customFields, estimatedValue, lastContactDate, nextFollowupDate, status, ...rest } = input
  const statusChanging = status !== undefined && status !== current.status

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.client.update({
      where: { id },
      data: {
        ...rest,
        ...(statusChanging && { status }),
        ...(estimatedValue !== undefined && { estimatedValue }),
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

    if (statusChanging) {
      await tx.activity.create({
        data: {
          ownerId,
          clientId: id,
          type: 'status_changed',
          detail: { from: current.status, to: status } as unknown as Prisma.InputJsonValue,
        },
      })
    }

    return result
  })

  if (statusChanging) {
    await refreshClientSummary(ownerId, id)
  }

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

export async function changeClientStatus(
  ownerId: string,
  id: string,
  newStatus: ClientStatus,
) {
  const current = await prisma.client.findFirst({
    where: { id, ownerId },
    select: { status: true },
  })
  if (!current) return null
  if (current.status === newStatus) return null

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.client.update({
      where: { id },
      data: { status: newStatus },
    })
    await tx.activity.create({
      data: {
        ownerId,
        clientId: id,
        type: 'status_changed',
        detail: { from: current.status, to: newStatus } as unknown as Prisma.InputJsonValue,
      },
    })
    return result
  })

  await refreshClientSummary(ownerId, id)
  return updated
}
