'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import {
  createInvoice,
  createInvoiceFromTimeEntries,
  updateInvoiceStatus,
  markInvoicePaid,
  setInvoiceArchived,
  deleteInvoice,
} from '@/lib/invoices'
import {
  createInvoiceSchema,
  createFromEntriesSchema,
  updateInvoiceStatusSchema,
  archiveInvoiceSchema,
} from '@/lib/invoices/validators'

export async function createInvoiceAction(data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = createInvoiceSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message }
  }
  try {
    const invoice = await createInvoice(ownerId, parsed.data)
    revalidatePath('/invoices')
    return { success: true as const, data: invoice }
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to create invoice' }
  }
}

export async function createInvoiceFromEntriesAction(data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = createFromEntriesSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message }
  }
  try {
    const invoice = await createInvoiceFromTimeEntries(ownerId, parsed.data)
    revalidatePath('/invoices')
    revalidatePath('/time')
    return { success: true as const, data: invoice }
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to create invoice' }
  }
}

export async function updateInvoiceStatusAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = updateInvoiceStatusSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message }
  }
  if (parsed.data.status === 'paid') {
    return { success: false as const, error: 'Use markInvoicePaidAction to mark as paid' }
  }
  try {
    const invoice = await updateInvoiceStatus(ownerId, id, parsed.data.status as 'draft' | 'sent' | 'overdue')
    if (!invoice) return { success: false as const, error: 'Invoice not found' }
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
    return { success: true as const, data: invoice }
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to update status' }
  }
}

export async function markInvoicePaidAction(id: string) {
  const ownerId = await getOwnerId()
  try {
    const invoice = await markInvoicePaid(ownerId, id)
    if (!invoice) return { success: false as const, error: 'Invoice not found' }
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
    revalidatePath('/finance')
    revalidatePath('/dashboard')
    return { success: true as const, data: invoice }
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to mark paid' }
  }
}

export async function setInvoiceArchivedAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = archiveInvoiceSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message }
  }
  try {
    const invoice = await setInvoiceArchived(ownerId, id, parsed.data.archived)
    if (!invoice) return { success: false as const, error: 'Invoice not found' }
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
    return { success: true as const, data: invoice }
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to archive invoice',
    }
  }
}

export async function deleteInvoiceAction(id: string) {
  const ownerId = await getOwnerId()
  try {
    const deleted = await deleteInvoice(ownerId, id)
    if (!deleted) return { success: false as const, error: 'Invoice not found' }
    revalidatePath('/invoices')
    revalidatePath('/time')
    return { success: true as const }
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to delete invoice' }
  }
}
