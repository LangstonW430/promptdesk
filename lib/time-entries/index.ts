import { prisma } from '@/lib/db/client'
import { serializeTimeEntry } from './serialize'
import type { CreateTimeEntryInput, UpdateTimeEntryInput } from './validators'

const WITH_JOIN = {
  project: {
    select: {
      title:  true,
      client: { select: { id: true, companyName: true, contactName: true } },
    },
  },
} as const

export interface ListTimeEntriesFilters {
  projectId?: string
  from?:      string  // YYYY-MM-DD inclusive
  to?:        string  // YYYY-MM-DD exclusive
}

export async function createTimeEntry(ownerId: string, input: CreateTimeEntryInput) {
  // Archived projects are not valid targets for new work.
  const projectCount = await prisma.project.count({
    where: { id: input.projectId, ownerId, isArchived: false },
  })
  if (projectCount === 0) throw new Error('Project not found')

  const row = await prisma.timeEntry.create({
    data: {
      ownerId,
      projectId:   input.projectId,
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
    include: {
      project: {
        select: {
          client: { select: { id: true, companyName: true, contactName: true } },
        },
      },
    },
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

  const client     = entries[0].project.client
  const clientId   = client.id
  const clientName = client.companyName ?? client.contactName ?? 'Client'

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
