import { z } from 'zod'

export const BUCKET_NAME = 'client-attachments'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/** MIME types accepted for upload. Validated on both client and server. */
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
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

export const confirmUploadSchema = z.object({
  storageKey: z.string().min(1).max(1000),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
  /**
   * Which of the client's projects the file belongs to. Omitted for files that
   * are about the client rather than one piece of work — an NDA, a W-9.
   */
  projectId: z.string().uuid().nullable().optional(),
})

export type RequestSignedUrlInput = z.infer<typeof requestSignedUrlSchema>
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>
