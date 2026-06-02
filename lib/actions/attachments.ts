'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import {
  requestSignedUploadUrl,
  saveAttachmentMetadata,
  deleteAttachment,
} from '@/lib/attachments'
import {
  requestSignedUrlSchema,
  confirmUploadSchema,
} from '@/lib/attachments/validators'

/** Step 1 of upload: generate a signed URL + token for direct browser-to-storage upload. */
export async function requestSignedUrlAction(clientId: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = requestSignedUrlSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const result = await requestSignedUploadUrl(ownerId, clientId, parsed.data)
    if (!result) return { error: 'Client not found' }
    return result // { signedUrl, token, storageKey }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to get upload URL' }
  }
}

/** Step 2 of upload: persist attachment metadata after the file has been uploaded. */
export async function saveAttachmentAction(clientId: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = confirmUploadSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const attachment = await saveAttachmentMetadata(ownerId, clientId, parsed.data)
  if (!attachment) return { error: 'Client not found or unauthorized' }

  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function deleteAttachmentAction(attachmentId: string, clientId: string) {
  const ownerId = await getOwnerId()
  const deleted = await deleteAttachment(ownerId, attachmentId)
  if (!deleted) return { error: 'Not found' }

  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}
