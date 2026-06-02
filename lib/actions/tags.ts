'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import { listTags, createTag, updateTag, deleteTag, attachTag, detachTag } from '@/lib/tags'
import { createTagSchema, updateTagSchema } from '@/lib/tags/validators'

export async function listTagsAction() {
  const ownerId = await getOwnerId()
  const tags = await listTags(ownerId)
  return {
    tags: tags.map((t) => ({
      id: t.id,
      label: t.label,
      color: t.color,
      clientCount: t._count.clientTags,
    })),
  }
}

export async function createTagAction(data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = createTagSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    const tag = await createTag(ownerId, parsed.data)
    revalidatePath('/settings')
    revalidatePath('/clients')
    return { tag }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to create tag' }
  }
}

export async function updateTagAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = updateTagSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    const tag = await updateTag(ownerId, id, parsed.data)
    if (!tag) return { error: 'Not found' }
    revalidatePath('/settings')
    revalidatePath('/clients')
    return { tag }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to update tag' }
  }
}

export async function deleteTagAction(id: string) {
  const ownerId = await getOwnerId()
  const deleted = await deleteTag(ownerId, id)
  if (!deleted) return { error: 'Not found' }
  revalidatePath('/settings')
  revalidatePath('/clients')
  return { success: true }
}

export async function attachTagAction(clientId: string, tagId: string) {
  const ownerId = await getOwnerId()
  const result = await attachTag(ownerId, clientId, tagId)
  if (!result) return { error: 'Client or tag not found' }
  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/clients')
  return { success: true }
}

export async function detachTagAction(clientId: string, tagId: string) {
  const ownerId = await getOwnerId()
  await detachTag(ownerId, clientId, tagId)
  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/clients')
  return { success: true }
}
