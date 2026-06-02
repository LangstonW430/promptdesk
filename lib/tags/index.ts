import { prisma } from '@/lib/db/client'
import type { CreateTagInput, UpdateTagInput } from './validators'

function isDuplicateError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: string }).code === 'P2002'
  )
}

export async function listTags(ownerId: string) {
  return prisma.tag.findMany({
    where: { ownerId },
    orderBy: { label: 'asc' },
    include: { _count: { select: { clientTags: true } } },
  })
}

export async function createTag(ownerId: string, input: CreateTagInput) {
  try {
    return await prisma.tag.create({
      data: { ownerId, label: input.label.trim(), color: input.color },
    })
  } catch (e) {
    if (isDuplicateError(e)) throw new Error('A tag with this label already exists')
    throw e
  }
}

export async function updateTag(ownerId: string, id: string, input: UpdateTagInput) {
  const exists = await prisma.tag.count({ where: { id, ownerId } })
  if (!exists) return null
  try {
    return await prisma.tag.update({
      where: { id },
      data: {
        ...(input.label !== undefined && { label: input.label.trim() }),
        ...(input.color !== undefined && { color: input.color }),
      },
    })
  } catch (e) {
    if (isDuplicateError(e)) throw new Error('A tag with this label already exists')
    throw e
  }
}

export async function deleteTag(ownerId: string, id: string): Promise<boolean> {
  const result = await prisma.tag.deleteMany({ where: { id, ownerId } })
  return result.count > 0
}

export async function attachTag(ownerId: string, clientId: string, tagId: string) {
  // Verify both client and tag belong to this owner
  const [clientCount, tagCount] = await Promise.all([
    prisma.client.count({ where: { id: clientId, ownerId } }),
    prisma.tag.count({ where: { id: tagId, ownerId } }),
  ])
  if (!clientCount || !tagCount) return null

  return prisma.clientTag.upsert({
    where: { clientId_tagId: { clientId, tagId } },
    create: { clientId, tagId },
    update: {},
  })
}

export async function detachTag(ownerId: string, clientId: string, tagId: string) {
  const clientCount = await prisma.client.count({ where: { id: clientId, ownerId } })
  if (!clientCount) return false
  const result = await prisma.clientTag.deleteMany({ where: { clientId, tagId } })
  return result.count > 0
}
