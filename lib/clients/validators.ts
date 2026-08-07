import { z } from 'zod'
import { CLIENT_STAGES } from './stage'

export const createClientSchema = z.object({
  companyName: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  leadSource: z.string().optional(),
  projectType: z.string().optional(),
  painPoints: z.string().optional(),
  requirements: z.string().optional(),
  opportunityNotes: z.string().optional(),
  lastContactDate: z.string().date().optional(),
  nextFollowupDate: z.string().date().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
})

export const updateClientSchema = createClientSchema
  .partial()
  .extend({
    lastContactDate: z.union([z.string().date(), z.literal('')]).optional(),
    nextFollowupDate: z.union([z.string().date(), z.literal('')]).optional(),
  })

export const listClientSchema = z.object({
  stage: z.enum(CLIENT_STAGES).optional(),
  q: z.string().optional(),
  tag: z.string().optional(),
  stale: z.coerce.number().int().positive().optional(),
  archived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

export const archiveClientSchema = z.object({
  archived: z.boolean(),
})

// Form schema — all string values (HTML inputs), with refinements for numeric fields.
// No .default() here: defaults live in clientFormDefaultValues so the resolver's
// TFieldValues stays non-optional and matches z.infer<typeof clientFormSchema>.
export const clientFormSchema = z.object({
  companyName: z.string(),
  contactName: z.string(),
  email: z.string(),
  phone: z.string(),
  website: z.string(),
  industry: z.string(),
  companySize: z.string(),
  leadSource: z.string(),
  projectType: z.string(),
  painPoints: z.string(),
  requirements: z.string(),
  opportunityNotes: z.string(),
  lastContactDate: z.string(),
  nextFollowupDate: z.string(),
})

export type ClientFormValues = z.infer<typeof clientFormSchema>

export const clientFormDefaultValues: ClientFormValues = {
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  industry: '',
  companySize: '',
  leadSource: '',
  projectType: '',
  painPoints: '',
  requirements: '',
  opportunityNotes: '',
  lastContactDate: '',
  nextFollowupDate: '',
}

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type ListClientInput = z.infer<typeof listClientSchema>
export type ArchiveClientInput = z.infer<typeof archiveClientSchema>
