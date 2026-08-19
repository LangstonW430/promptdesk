'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import {
  createInvoice,
  createInvoiceFromTimeEntries,
  sendInvoice,
  refreshInvoice,
  setInvoiceArchived,
  deleteInvoice,
  describeStripeError,
} from '@/lib/invoices'
import {
  createInvoiceSchema,
  createFromEntriesSchema,
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
    // Raising an invoice now talks to Stripe, so most failures here are Stripe
    // failures — a missing permission or a client with no email address. Those
    // messages say what to do about it; the generic fallback would not.
    return { success: false as const, error: describeStripeError(err) }
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
    return { success: false as const, error: describeStripeError(err) }
  }
}

/**
 * Finalizes the invoice in Stripe and emails it to the client.
 *
 * Replaces the old status flip to "sent", which only changed a value in our own
 * database and left the operator to send the invoice themselves.
 */
export async function sendInvoiceAction(id: string) {
  const ownerId = await getOwnerId()
  try {
    const invoice = await sendInvoice(ownerId, id)
    if (!invoice) return { success: false as const, error: 'Invoice not found' }
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
    return { success: true as const, data: invoice }
  } catch (err) {
    return { success: false as const, error: describeStripeError(err) }
  }
}

/**
 * Re-reads the invoice from Stripe.
 *
 * The webhook is the normal path for status changes. This is the manual one,
 * for an invoice edited in the Stripe dashboard or a webhook that never
 * arrived — which is the whole story for a user whose key cannot register an
 * endpoint.
 */
export async function refreshInvoiceAction(id: string) {
  const ownerId = await getOwnerId()
  try {
    const invoice = await refreshInvoice(ownerId, id)
    if (!invoice) {
      return {
        success: false as const,
        error: 'This invoice has no Stripe record to refresh from.',
      }
    }
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
    revalidatePath('/finance')
    return { success: true as const, data: invoice }
  } catch (err) {
    return { success: false as const, error: describeStripeError(err) }
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

/**
 * Deletes a draft, or voids a finalized invoice.
 *
 * Which one happens is Stripe's rule, so the result says which — a user who
 * asked to delete an invoice and got a void needs to know it still exists.
 */
export async function deleteInvoiceAction(id: string) {
  const ownerId = await getOwnerId()
  try {
    const outcome = await deleteInvoice(ownerId, id)
    if (!outcome) return { success: false as const, error: 'Invoice not found' }
    revalidatePath('/invoices')
    revalidatePath('/time')
    return { success: true as const, outcome }
  } catch (err) {
    return { success: false as const, error: describeStripeError(err) }
  }
}
