import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET_NAME } from './validators'
import type { RequestSignedUrlInput, ConfirmUploadInput } from './validators'

/** Replace any character that is not alphanumeric, dot, dash, or underscore. */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-]/g, '_')
}

/**
 * Generates a signed upload URL for Supabase Storage.
 * The storage key format is `{ownerId}/{clientId}/{uuid}-{sanitizedFileName}`
 * so every file is namespaced under its owner.
 */
export async function requestSignedUploadUrl(
  ownerId: string,
  clientId: string,
  input: RequestSignedUrlInput,
) {
  const ok = await prisma.client.count({ where: { id: clientId, ownerId } })
  if (!ok) return null

  const safeName = sanitizeFileName(input.fileName)
  const storageKey = `${ownerId}/${clientId}/${randomUUID()}-${safeName}`

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(storageKey)

  if (error || !data) throw new Error(error?.message ?? 'Failed to create upload URL')

  return { signedUrl: data.signedUrl, token: data.token, storageKey }
}

/**
 * Saves attachment metadata to the database after a successful upload.
 * Validates that storageKey starts with `{ownerId}/` to prevent path spoofing.
 */
export async function saveAttachmentMetadata(
  ownerId: string,
  clientId: string,
  input: ConfirmUploadInput,
) {
  const ok = await prisma.client.count({ where: { id: clientId, ownerId } })
  if (!ok) return null

  // Prevent spoofing another owner's namespace
  if (!input.storageKey.startsWith(`${ownerId}/`)) return null

  // A project id must belong to this owner *and* to this client, or the file
  // would be filed against someone else's work. Checked rather than trusted:
  // it arrives from the request body like everything else.
  if (input.projectId) {
    const validProject = await prisma.project.count({
      where: { id: input.projectId, ownerId, clientId },
    })
    if (!validProject) return null
  }

  return prisma.attachment.create({
    data: {
      ownerId,
      clientId,
      projectId: input.projectId ?? null,
      fileName: input.fileName,
      storageKey: input.storageKey,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes != null ? BigInt(input.sizeBytes) : null,
    },
  })
}

/**
 * The files attached to one project. The project page reads this so a proposal
 * or a signed scope sits with the work it belongs to, rather than only in the
 * client's undifferentiated file list.
 */
export async function listProjectAttachments(ownerId: string, projectId: string) {
  const rows = await prisma.attachment.findMany({
    where: { ownerId, projectId },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    // BigInt does not survive the server/client boundary.
    sizeBytes: a.sizeBytes != null ? Number(a.sizeBytes) : null,
    createdAt: a.createdAt.toISOString(),
  }))
}

export type ProjectAttachment = Awaited<
  ReturnType<typeof listProjectAttachments>
>[number]

/**
 * Generates a short-lived signed download URL (60 s) that forces a file download
 * via Content-Disposition: attachment.
 */
export async function getSignedDownloadUrl(ownerId: string, attachmentId: string) {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ownerId },
    select: { storageKey: true, fileName: true },
  })
  if (!attachment) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(attachment.storageKey, 60, {
      download: attachment.fileName,
    })

  if (error || !data) throw new Error(error?.message ?? 'Failed to create download URL')
  return data.signedUrl
}

/**
 * Deletes a file from Supabase Storage and removes the DB record.
 * Storage errors are logged but do not prevent the DB record from being removed —
 * a dangling object in storage is preferable to a dangling DB row.
 */
export async function deleteAttachment(ownerId: string, attachmentId: string) {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ownerId },
    select: { id: true, storageKey: true },
  })
  if (!attachment) return false

  const supabase = createAdminClient()
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([attachment.storageKey])
  if (error) console.error('[storage] delete error:', error.message)

  await prisma.attachment.delete({ where: { id: attachment.id } })
  return true
}
