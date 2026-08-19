import { z } from 'zod'

export const lineItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  amount: z.number().min(0),
})

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid('Client is required'),
  projectId: z.string().uuid().nullable().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  tax: z.number().min(0).max(100).nullable().optional(),
  paymentTerms: z.string().max(120).nullable().optional(),
  purchaseOrder: z.string().max(120).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const createFromEntriesSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1, 'Select at least one entry'),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  tax: z.number().min(0).max(100).nullable().optional(),
  paymentTerms: z.string().max(120).nullable().optional(),
  purchaseOrder: z.string().max(120).nullable().optional(),
  notes: z.string().nullable().optional(),
})

// updateInvoiceStatusSchema is gone. Status is Stripe's to set — finalizing,
// sending, payment, voiding and write-off all happen there and arrive by
// webhook. An endpoint that let the app write its own status could only ever
// produce a value the payment processor disagreed with.

export const archiveInvoiceSchema = z.object({
  archived: z.boolean(),
})

/** Null detaches the invoice from its client, leaving it unattributed. */
export const linkInvoiceSchema = z.object({
  clientId: z.string().uuid('Select a client').nullable(),
})

/**
 * The fields Stripe still permits on an existing invoice.
 *
 * Deliberately excludes line items and amounts: Stripe treats a finalized
 * invoice as an issued financial document and refuses to change its totals.
 * Accepting them here would produce a form whose submit fails at the API.
 */
export const editInvoiceSchema = z.object({
  notes: z.string().max(1500).nullable().optional(),
  paymentTerms: z.string().max(120).nullable().optional(),
  purchaseOrder: z.string().max(120).nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type CreateFromEntriesInput = z.infer<typeof createFromEntriesSchema>
export type ArchiveInvoiceInput = z.infer<typeof archiveInvoiceSchema>
export type LinkInvoiceInput = z.infer<typeof linkInvoiceSchema>
export type EditInvoiceInput = z.infer<typeof editInvoiceSchema>
