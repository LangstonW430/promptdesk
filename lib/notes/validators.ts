import { z } from 'zod'
import { NOTE_TYPES } from './types'

export const createNoteSchema = z.object({
  body: z.string().min(1, 'Note body is required').max(10000),
  noteType: z.enum(NOTE_TYPES).default('note'),
  // YYYY-MM-DD; domain converts to Date and defaults to today when absent
  occurredAt: z.string().date().optional(),
})

export const deleteNoteSchema = z.object({
  id: z.string().uuid(),
})

export type CreateNoteInput = z.infer<typeof createNoteSchema>
