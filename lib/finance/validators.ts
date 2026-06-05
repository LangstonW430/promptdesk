import { z } from 'zod'
import { ALL_CATEGORIES } from './categories'

const validCategory = (v: string) =>
  ALL_CATEGORIES.includes(v as (typeof ALL_CATEGORIES)[number])

export const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.string().default('usd'),
  description: z.string().optional(),
  category: z.string().refine(validCategory, { message: 'Invalid category' }),
  occurredAt: z.string().date(),
  clientId: z.string().uuid().optional(),
  isRecurring: z.boolean().default(false),
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
  isRecurring: z.boolean().optional(),
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
  isRecurring: z.boolean(),
})

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
export type TransactionFormValues = z.infer<typeof transactionFormSchema>

export const transactionFormDefaultValues: TransactionFormValues = {
  type: 'income',
  amount: '',
  description: '',
  category: '',
  occurredAt: '',
  clientId: '',
  isRecurring: false,
}
