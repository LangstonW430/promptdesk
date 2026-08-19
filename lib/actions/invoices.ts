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
  importStripeInvoices,
  linkInvoiceToClient,
  remindInvoice,
  markInvoicePaidOutOfBand,
  writeOffInvoice,
  editInvoice,
} from '@/lib/invoices'
import {
  createInvoiceSchema,
  createFromEntriesSchema,
  archiveInvoiceSchema,
  linkInvoiceSchema,
  editInvoiceSchema,
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

/**
 * Pulls every invoice from Stripe into the list.
 *
 * Invoices raised in the Stripe dashboard, by a subscription, or by anything
 * that never went through this app were previously invisible here.
 */
export async function importStripeInvoicesAction() {
  const ownerId = await getOwnerId()
  try {
    const result = await importStripeInvoices(ownerId)
    revalidatePath('/invoices')
    return { success: true as const, data: result }
  } catch (err) {
    return { success: false as const, error: describeStripeError(err) }
  }
}

/** Attaches an unattributed invoice to a client, or detaches it. */
export async function linkInvoiceToClientAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = linkInvoiceSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message }
  }
  try {
    const invoice = await linkInvoiceToClient(ownerId, id, parsed.data.clientId)
    if (!invoice) return { success: false as const, error: 'Invoice not found' }
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
    return { success: true as const, data: invoice }
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to link invoice',
    }
  }
}

/** Re-sends the invoice email. Stripe's reminder is the same call as the send. */
export async function remindInvoiceAction(id: string) {
  const ownerId = await getOwnerId()
  try {
    const invoice = await remindInvoice(ownerId, id)
    if (!invoice) return { success: false as const, error: 'Invoice not found' }
    revalidatePath(`/invoices/${id}`)
    return { success: true as const, data: invoice }
  } catch (err) {
    return { success: false as const, error: describeStripeError(err) }
  }
}

/** Records payment that arrived outside Stripe — bank transfer, cheque. */
export async function markInvoicePaidOutOfBandAction(id: string) {
  const ownerId = await getOwnerId()
  try {
    const invoice = await markInvoicePaidOutOfBand(ownerId, id)
    if (!invoice) return { success: false as const, error: 'Invoice not found' }
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
    revalidatePath('/finance')
    return { success: true as const, data: invoice }
  } catch (err) {
    return { success: false as const, error: describeStripeError(err) }
  }
}

/** Writes the invoice off as uncollectible. Distinct from voiding. */
export async function writeOffInvoiceAction(id: string) {
  const ownerId = await getOwnerId()
  try {
    const invoice = await writeOffInvoice(ownerId, id)
    if (!invoice) return { success: false as const, error: 'Invoice not found' }
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
    return { success: true as const, data: invoice }
  } catch (err) {
    return { success: false as const, error: describeStripeError(err) }
  }
}

/**
 * Edits the fields Stripe still allows.
 *
 * Amounts and line items are not among them once an invoice is finalized —
 * Stripe treats it as an issued document, and the dashboard voids and reissues
 * rather than editing.
 */
export async function editInvoiceAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = editInvoiceSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message }
  }
  try {
    const invoice = await editInvoice(ownerId, id, {
      notes: parsed.data.notes,
      paymentTerms: parsed.data.paymentTerms,
      purchaseOrder: parsed.data.purchaseOrder,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    })
    if (!invoice) return { success: false as const, error: 'Invoice not found' }
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
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
