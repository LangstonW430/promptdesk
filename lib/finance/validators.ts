import { z } from 'zod'
import { ALL_CATEGORIES } from './categories'

const validCategory = (v: string) =>
  ALL_CATEGORIES.includes(v as (typeof ALL_CATEGORIES)[number])

const FREQUENCIES = ['monthly', 'quarterly', 'annual'] as const

export const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.string().default('usd'),
  description: z.string().optional(),
  category: z.string().refine(validCategory, { message: 'Invalid category' }),
  occurredAt: z.string().date(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  isRecurring: z.boolean().default(false),
  frequency: z.enum(FREQUENCIES).optional(),
  recurrenceEndedAt: z.string().date().nullable().optional(),
})

// For updates, financial fields (type/amount/currency) are only editable on manual rows.
// The lib enforces this; the schema accepts them as optional for both paths.
export const updateTransactionSchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  amount: z.number().positive('Amount must be greater than 0').optional(),
  currency: z.string().optional(),
  description: z.string().nullable().optional(),
  category: z
    .string()
    .refine((v) => !v || validCategory(v), { message: 'Invalid category' })
    .optional(),
  occurredAt: z.string().date().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  isRecurring: z.boolean().optional(),
  frequency: z.enum(FREQUENCIES).nullable().optional(),
  recurrenceEndedAt: z.string().date().nullable().optional(),
})

/**
 * A rate change on a standing charge: the same charge, at a different price or
 * cadence, from `effectiveFrom` onward.
 *
 * Separate from an update because it is a different intent. Updating rewrites
 * the charge, and a standing charge is what every month it covers reads its
 * figure from — so a new price applied that way reaches back and restates
 * months that were billed at the old one. This carries the date the change
 * took effect, which is the piece an update has no way to express.
 */
export const supersedeStandingChargeSchema = z.object({
  effectiveFrom: z.string().date(),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be greater than 0'),
  description: z.string().nullable().optional(),
  category: z.string().refine(validCategory, { message: 'Invalid category' }),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  frequency: z.enum(FREQUENCIES),
})

// Form schema — all HTML inputs are strings; numeric/UUID fields are refined strings.
export const transactionFormSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z
    .string()
    .refine((v) => v !== '' && !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: 'Must be a valid positive amount',
    }),
  description: z.string(),
  category: z.string().min(1, 'Category is required'),
  occurredAt: z.string().min(1, 'Date is required'),
  clientId: z.string(),  // '' means no client
  projectId: z.string(), // '' means no project — overheads have none
  isRecurring: z.boolean(),
  frequency: z.string(),  // '' | 'monthly' | 'quarterly' | 'annual'
  recurrenceEndedAt: z.string(),  // '' | YYYY-MM-DD
})

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
export type SupersedeStandingChargeInput = z.infer<typeof supersedeStandingChargeSchema>
export type TransactionFormValues = z.infer<typeof transactionFormSchema>

export const transactionFormDefaultValues: TransactionFormValues = {
  type: 'income',
  amount: '',
  description: '',
  category: '',
  occurredAt: '',
  clientId: '',
  projectId: '',
  isRecurring: false,
  frequency: 'monthly',
  recurrenceEndedAt: '',
}
