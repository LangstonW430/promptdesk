import type { Prisma } from '@/lib/generated/prisma/client'
import type { ClientFilters } from './types'

/**
 * Builds a Prisma ClientWhereInput for the given owner and filters.
 * Pure function — no I/O. Every condition is AND'd together so filters compose safely.
 */
export function buildClientWhere(
  ownerId: string,
  filters: ClientFilters = {},
): Prisma.ClientWhereInput {
  const conditions: Prisma.ClientWhereInput[] = [
    { ownerId },
    { isArchived: filters.archived ?? false },
  ]

  if (filters.status) {
    conditions.push({ status: filters.status })
  }

  if (filters.q) {
    conditions.push({
      OR: [
        { companyName: { contains: filters.q, mode: 'insensitive' } },
        { contactName: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
      ],
    })
  }

  if (filters.tag) {
    conditions.push({
      clientTags: {
        some: {
          tag: {
            label: { equals: filters.tag, mode: 'insensitive' },
            ownerId,
          },
        },
      },
    })
  }

  if (filters.stale != null && filters.stale > 0) {
    const threshold = new Date()
    threshold.setDate(threshold.getDate() - filters.stale)

    conditions.push({ status: { notIn: ['won', 'lost'] } })
    conditions.push({
      OR: [
        { lastContactDate: { lt: threshold } },
        {
          AND: [
            { lastContactDate: { equals: null } },
            { createdAt: { lt: threshold } },
          ],
        },
      ],
    })
  }

  return { AND: conditions }
}
