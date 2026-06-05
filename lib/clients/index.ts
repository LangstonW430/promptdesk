import type { Prisma } from '@/lib/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { refreshClientSummary } from '@/lib/relationship-summary/refresh'
import { buildClientWhere } from './filters'
import type { ClientFilters, ClientStatus } from './types'
import type { CreateClientInput, UpdateClientInput } from './validators'

const withRelations = {
  notes:       { orderBy: { occurredAt: 'desc' as const } },
  tasks:       { orderBy: [{ isDone: 'asc' as const }, { dueDate: 'asc' as const }] },
  attachments: { orderBy: { createdAt: 'desc' as const } },
  clientTags:  { include: { tag: true } },
  activities:  { orderBy: { createdAt: 'desc' as const }, take: 20 },
  projects:    { where: { status: { not: 'cancelled' } }, orderBy: { updatedAt: 'desc' as const } },
  timeEntries: {
    include: { project: { select: { title: true } } },
    orderBy: [{ date: 'desc' as const }, { createdAt: 'desc' as const }],
    take: 20,
  },
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

export async function listClients(ownerId: string, filters: ClientFilters = {}) {
  return prisma.client.findMany({
    where: buildClientWhere(ownerId, filters),
    include: { clientTags: { include: { tag: true } } },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function updateClient(
  ownerId: string,
  id: string,
  input: UpdateClientInput,
) {
  const exists = await prisma.client.count({ where: { id, ownerId } })
  if (!exists) return null

  const { customFields, estimatedValue, lastContactDate, nextFollowupDate, ...rest } = input

  return prisma.client.update({
    where: { id },
    data: {
      ...rest,
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
