import { z } from 'zod'

export const createTimeEntrySchema = z.object({
  clientId:    z.string().uuid(),
  projectId:   z.string().uuid().nullable().optional(),
  date:        z.string().date(),
  hours:       z.number().positive().max(24, 'Hours cannot exceed 24'),
  rate:        z.number().nonnegative().nullable().optional(),
  description: z.string().optional(),
  isBillable:  z.boolean().default(true),
})

export const updateTimeEntrySchema = z.object({
  date:        z.string().date().optional(),
  hours:       z.number().positive().max(24).optional(),
  rate:        z.number().nonnegative().nullable().optional(),
  description: z.string().nullable().optional(),
  isBillable:  z.boolean().optional(),
  projectId:   z.string().uuid().nullable().optional(),
})

export const convertToInvoiceSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1, 'Select at least one entry'),
})

// Form schema — all HTML inputs come in as strings
export const timeEntryFormSchema = z.object({
  date:        z.string().min(1, 'Date is required'),
  hours:       z.string().refine(
    (v) => v !== '' && !Number.isNaN(Number(v)) && Number(v) > 0 && Number(v) <= 24,
    { message: 'Hours must be between 0 and 24' },
  ),
  rate:        z.string(), // '' → no rate
  description: z.string(),
  isBillable:  z.boolean(),
  projectId:   z.string(), // '' → no project
})

export type CreateTimeEntryInput  = z.infer<typeof createTimeEntrySchema>
export type UpdateTimeEntryInput  = z.infer<typeof updateTimeEntrySchema>
export type ConvertToInvoiceInput = z.infer<typeof convertToInvoiceSchema>
export type TimeEntryFormValues   = z.infer<typeof timeEntryFormSchema>

export const timeEntryFormDefaultValues: TimeEntryFormValues = {
  date:        '',
  hours:       '',
  rate:        '',
  description: '',
  isBillable:  true,
  projectId:   '',
}
