import { prisma } from '@/lib/db/client'
import { serializeTimeEntry } from './serialize'
import type { CreateTimeEntryInput, UpdateTimeEntryInput } from './validators'

const WITH_JOIN = {
  client:  { select: { companyName: true, contactName: true } },
  project: { select: { title: true } },
} as const

export interface ListTimeEntriesFilters {
  clientId?:  string
  projectId?: string
  from?:      string  // YYYY-MM-DD inclusive
  to?:        string  // YYYY-MM-DD exclusive
}

export async function createTimeEntry(ownerId: string, input: CreateTimeEntryInput) {
  const clientCount = await prisma.client.count({ where: { id: input.clientId, ownerId } })
  if (clientCount === 0) throw new Error('Client not found')

  if (input.projectId) {
    const projectCount = await prisma.project.count({ where: { id: input.projectId, ownerId } })
    if (projectCount === 0) throw new Error('Project not found')
  }

  const row = await prisma.timeEntry.create({
    data: {
      ownerId,
      clientId:    input.clientId,
      projectId:   input.projectId ?? null,
      date:        new Date(input.date),
      hours:       input.hours,
      rate:        input.rate ?? null,
      description: input.description ?? null,
      isBillable:  input.isBillable ?? true,
    },
    include: WITH_JOIN,
  })
  return serializeTimeEntry(row)
}

export async function listTimeEntries(ownerId: string, filters: ListTimeEntriesFilters = {}) {
  const rows = await prisma.timeEntry.findMany({
    where: {
      ownerId,
      ...(filters.clientId  && { clientId:  filters.clientId }),
      ...(filters.projectId && { projectId: filters.projectId }),
      ...((filters.from || filters.to) && {
        date: {
          ...(filters.from && { gte: new Date(filters.from) }),
          ...(filters.to   && { lt:  new Date(filters.to) }),
        },
      }),
    },
    include: WITH_JOIN,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map(serializeTimeEntry)
}

export async function updateTimeEntry(ownerId: string, id: string, input: UpdateTimeEntryInput) {
  const count = await prisma.timeEntry.count({ where: { id, ownerId } })
  if (count === 0) return null

  const row = await prisma.timeEntry.update({
    where: { id },
    data: {
      ...(input.date        !== undefined && { date:        new Date(input.date) }),
      ...(input.hours       !== undefined && { hours:       input.hours }),
      ...('rate'        in input           && { rate:        input.rate ?? null }),
      ...('description' in input           && { description: input.description ?? null }),
      ...(input.isBillable  !== undefined && { isBillable:  input.isBillable }),
      ...('projectId'   in input           && { projectId:   input.projectId ?? null }),
    },
    include: WITH_JOIN,
  })
  return serializeTimeEntry(row)
}

export async function deleteTimeEntry(ownerId: string, id: string): Promise<boolean> {
  const result = await prisma.timeEntry.deleteMany({ where: { id, ownerId } })
  return result.count > 0
}

// ── Convert billable entries to a rolled-up income Transaction ───────────────

export async function convertToInvoice(ownerId: string, entryIds: string[]) {
  const entries = await prisma.timeEntry.findMany({
    where: { id: { in: entryIds }, ownerId, isBillable: true },
    include: { client: { select: { id: true, companyName: true, contactName: true } } },
  })
  if (entries.length === 0) throw new Error('No billable entries found')

  let total = 0
  let totalHours = 0
  for (const e of entries) {
    const h = typeof e.hours === 'object' ? e.hours.toNumber() : Number(e.hours)
    const r = e.rate != null
      ? (typeof e.rate === 'object' ? e.rate.toNumber() : Number(e.rate))
      : 0
    total += h * r
    totalHours += h
  }
  if (total <= 0) throw new Error('Total is $0 — set a rate on each entry before converting')

  const clientId   = entries[0].client.id
  const clientName = entries[0].client.companyName ?? entries[0].client.contactName ?? 'Client'

  const transaction = await prisma.transaction.create({
    data: {
      ownerId,
      type:        'income',
      source:      'manual',
      amount:      total,
      currency:    'usd',
      description: `${totalHours.toFixed(1)}h billed to ${clientName}`,
      category:    'Client work',
      occurredAt:  new Date(),
      clientId,
      isRecurring: false,
    },
  })

  return transaction
}
