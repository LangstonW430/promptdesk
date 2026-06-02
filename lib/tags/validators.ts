import { z } from 'zod'

export const TAG_COLORS = [
  'gray', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink',
] as const
export type TagColor = (typeof TAG_COLORS)[number]

export const createTagSchema = z.object({
  label: z.string().min(1, 'Label is required').max(50),
  color: z.enum(TAG_COLORS).default('gray'),
})

export const updateTagSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  color: z.enum(TAG_COLORS).optional(),
})

export type CreateTagInput = z.infer<typeof createTagSchema>
export type UpdateTagInput = z.infer<typeof updateTagSchema>
