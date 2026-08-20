import { z } from 'zod'

export const BUCKET_NAME = 'client-attachments'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * MIME types accepted for upload. Validated on both client and server.
 *
 * `image/svg+xml` is deliberately absent. An SVG is a document that can carry
 * script, so it is only ever as safe as the way it is served — today the
 * download route forces `Content-Disposition: attachment`, which does contain
 * it, but that is one route's behaviour standing between a stored file and
 * script running on our origin. A bucket made public, a preview added, an
 * inline render for thumbnails: any of those turns a stored file into stored
 * XSS. Raster formats cover what attachments are for.
 */
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Spreadsheets
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Plain text
  'text/plain',
  'text/csv',
])

export const requestSignedUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z
    .string()
    .refine((t) => ALLOWED_MIME_TYPES.has(t), 'File type not allowed'),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE, 'File too large (max 10 MB)'),
})

/**
 * Step 2 of the upload, once the file is in storage.
 *
 * `mimeType` and `sizeBytes` used to be an unconstrained string and an
 * unbounded number here, even though step 1 validated both — so the values
 * actually recorded against the row were whatever the caller sent, regardless
 * of what they asked permission for. Same rules as `requestSignedUrlSchema`,
 * for the same reason it has them.
 */
export const confirmUploadSchema = z.object({
  storageKey: z.string().min(1).max(1000),
  fileName: z.string().min(1).max(255),
  mimeType: z
    .string()
    .refine((t) => ALLOWED_MIME_TYPES.has(t), 'File type not allowed')
    .optional(),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE, 'File too large (max 10 MB)').optional(),
  /**
   * Which of the client's projects the file belongs to. Omitted for files that
   * are about the client rather than one piece of work — an NDA, a W-9.
   */
  projectId: z.string().uuid().nullable().optional(),
})

export type RequestSignedUrlInput = z.infer<typeof requestSignedUrlSchema>
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>
