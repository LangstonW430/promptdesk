import { z } from 'zod'
import { CLIENT_STAGES } from './stage'

/**
 * Lengths, because there were none.
 *
 * Every field was an unbounded `z.string()`, and `customFields` accepted
 * arbitrary JSON of any size. Nothing here is attacker-reachable without an
 * account, so this is not the front line — but "authenticated" is a low bar on
 * a product with open signup, and a few requests could put as much as the body
 * parser would carry into a row that is then read back on the dashboard, the
 * client list, and into every prompt built from it.
 *
 * The limits are generous enough that no real value meets them: SHORT for
 * things that are a name or an identifier, LONG for the free-text fields
 * somebody might genuinely paste a paragraph into.
 */
const SHORT = 200
const LONG = 5_000

export const createClientSchema = z.object({
  companyName: z.string().max(SHORT).optional(),
  contactName: z.string().max(SHORT).optional(),
  email: z.string().max(SHORT).optional(),
  phone: z.string().max(SHORT).optional(),
  website: z.string().max(SHORT).optional(),
  address: z.string().max(LONG).optional(),
  industry: z.string().max(SHORT).optional(),
  companySize: z.string().max(SHORT).optional(),
  leadSource: z.string().max(SHORT).optional(),
  painPoints: z.string().max(LONG).optional(),
  requirements: z.string().max(LONG).optional(),
  opportunityNotes: z.string().max(LONG).optional(),
  lastContactDate: z.string().date().optional(),
  nextFollowupDate: z.string().date().optional(),
  // Bounded on both axes: how many keys, and how large each value serialises.
  customFields: z
    .record(z.string().max(SHORT), z.unknown())
    .refine((v) => Object.keys(v).length <= 50, 'Too many custom fields')
    .refine(
      (v) => JSON.stringify(v).length <= 20_000,
      'Custom fields are too large',
    )
    .optional(),
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
  address: z.string(),
  industry: z.string(),
  companySize: z.string(),
  leadSource: z.string(),
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
  address: '',
  industry: '',
  companySize: '',
  leadSource: '',
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
