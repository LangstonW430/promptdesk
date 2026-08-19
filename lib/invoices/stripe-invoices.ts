/**
 * Every Stripe call the invoice system makes.
 *
 * Split from stripe-mapper.ts on the same line the finance module draws: the
 * mapper is pure and unit-tested, this does I/O and is not. Nothing here writes
 * to our database either — callers in lib/invoices/index.ts own the mirror row,
 * so a Stripe failure never leaves a half-written invoice behind.
 */

import Stripe from 'stripe'
import { prisma } from '@/lib/db/client'
import { getStripeForOwner } from '@/lib/finance/stripe-client'
import { lineItemsToInvoiceItems, daysUntilDue } from './stripe-mapper'
import type { LineItem } from './types'

const CURRENCY = 'usd'

/**
 * Turns a Stripe error into something the user can act on.
 *
 * The default message for a missing permission names a raw API path, which
 * tells a freelancer nothing about which checkbox to tick. Everything else is
 * passed through — Stripe's validation messages are usually clearer than
 * anything we would write over them.
 */
export function describeStripeError(err: unknown): string {
  if (err instanceof Stripe.errors.StripePermissionError) {
    return (
      'Your Stripe key is missing a permission this needs. Edit the restricted ' +
      'key in your Stripe dashboard and set Invoices, Customers, and Tax Rates ' +
      'to Write, then save it again in Settings.'
    )
  }
  if (err instanceof Stripe.errors.StripeAuthenticationError) {
    return 'Stripe rejected your API key. Re-enter it in Settings.'
  }
  if (err instanceof Stripe.errors.StripeError) {
    return err.message
  }
  return err instanceof Error ? err.message : 'Stripe request failed'
}

// ─── Customers ────────────────────────────────────────────────────────────────

/**
 * The Stripe customer for a CRM client, created if they do not have one yet.
 *
 * Reuses `Client.stripeCustomerId`, which the finance sync already back-fills
 * by matching charge emails, so an invoice raised for a client who has paid
 * before goes to the customer record Stripe already holds rather than a
 * duplicate.
 *
 * The id is written back to the client row, making this idempotent: the second
 * invoice for the same client makes no customer call at all.
 */
export async function ensureStripeCustomer(
  stripe: Stripe,
  ownerId: string,
  clientId: string,
): Promise<string> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, ownerId },
    select: {
      id: true,
      stripeCustomerId: true,
      companyName: true,
      contactName: true,
      email: true,
      address: true,
    },
  })
  if (!client) throw new Error('Client not found')

  if (client.stripeCustomerId) {
    // Trust but verify: a customer deleted in the Stripe dashboard would make
    // every later call fail with a confusing "no such customer".
    try {
      const existing = await stripe.customers.retrieve(client.stripeCustomerId)
      if (!existing.deleted) return client.stripeCustomerId
    } catch {
      // Falls through to creating a replacement.
    }
  }

  const name = client.companyName ?? client.contactName ?? undefined
  if (!client.email) {
    throw new Error(
      `${name ?? 'This client'} has no email address. Stripe emails the invoice ` +
        'to the client, so add one on their profile first.',
    )
  }

  const customer = await stripe.customers.create({
    name,
    email: client.email,
    ...(client.address && { address: { line1: client.address } }),
    metadata: { promptdeskClientId: client.id, promptdeskOwnerId: ownerId },
  })

  await prisma.client.update({
    where: { id: client.id },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}

// ─── Tax rates ────────────────────────────────────────────────────────────────

/**
 * A Stripe tax rate for the given percentage, reused across invoices.
 *
 * Tax is a real Stripe TaxRate rather than an extra line item so it lands in
 * Stripe's tax reporting and prints as tax on the invoice — a synthetic "Tax"
 * line would just look like another service to the client's bookkeeper.
 *
 * Stripe tax rates are immutable and accumulate, so this looks for an active
 * one at the same percentage before creating another.
 */
export async function findOrCreateTaxRate(
  stripe: Stripe,
  percentage: number,
): Promise<string> {
  const existing = await stripe.taxRates.list({ active: true, limit: 100 })
  const match = existing.data.find(
    (rate) => rate.percentage === percentage && !rate.inclusive,
  )
  if (match) return match.id

  const created = await stripe.taxRates.create({
    display_name: 'Tax',
    percentage,
    inclusive: false,
  })
  return created.id
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface CreateStripeInvoiceInput {
  customerId: string
  lineItems: readonly LineItem[]
  issueDate: Date
  dueDate: Date
  /** Tax percentage, e.g. 8.5. Null for no tax. */
  taxRate?: number | null
  notes?: string | null
  paymentTerms?: string | null
  purchaseOrder?: string | null
  /** Written to Stripe so a webhook can find our row without a lookup table. */
  metadata: Record<string, string>
}

/**
 * Creates a draft invoice in Stripe with its line items attached.
 *
 * The invoice is created before its items, with
 * `pending_invoice_items_behavior: 'exclude'`. Created the other way round,
 * Stripe sweeps every unattached invoice item on the customer onto the next
 * invoice — so two invoices raised for the same client in quick succession
 * would merge, and a half-finished draft would poison the next one.
 *
 * `auto_advance: false` keeps it a draft. Nothing is sent until sendInvoice.
 */
export async function createStripeInvoice(
  stripe: Stripe,
  input: CreateStripeInvoiceInput,
): Promise<Stripe.Invoice> {
  const taxRateIds =
    input.taxRate != null && input.taxRate > 0
      ? [await findOrCreateTaxRate(stripe, input.taxRate)]
      : undefined

  const invoice = await stripe.invoices.create({
    customer: input.customerId,
    collection_method: 'send_invoice',
    days_until_due: daysUntilDue(input.issueDate, input.dueDate),
    auto_advance: false,
    pending_invoice_items_behavior: 'exclude',
    ...(input.notes && { description: input.notes }),
    ...(input.paymentTerms && { footer: input.paymentTerms }),
    ...(input.purchaseOrder && {
      // Stripe caps custom field values at 30 characters and rejects longer
      // ones outright, which would fail the whole invoice over a reference.
      custom_fields: [
        { name: 'PO Number', value: input.purchaseOrder.slice(0, 30) },
      ],
    }),
    ...(taxRateIds && { default_tax_rates: taxRateIds }),
    metadata: input.metadata,
  })

  for (const item of lineItemsToInvoiceItems(input.lineItems, CURRENCY)) {
    await stripe.invoiceItems.create({
      customer: input.customerId,
      invoice: invoice.id,
      amount: item.amount,
      currency: item.currency,
      description: item.description,
    })
  }

  // Re-read so totals reflect the items just attached: the create response was
  // computed before they existed and reports a total of zero.
  return stripe.invoices.retrieve(invoice.id!, { expand: ['lines'] })
}

/**
 * Finalizes the invoice and emails it to the client.
 *
 * Two steps because they mean different things and can fail independently:
 * finalizing assigns the number and locks the contents, sending is what puts it
 * in the client's inbox. A finalized invoice that failed to send is still a
 * real invoice with a payable link, so the caller mirrors whatever state we
 * reached rather than treating a send failure as total failure.
 */
export async function finalizeAndSendInvoice(
  stripe: Stripe,
  stripeInvoiceId: string,
): Promise<Stripe.Invoice> {
  const finalized = await stripe.invoices.finalizeInvoice(stripeInvoiceId, {
    expand: ['lines'],
  })
  return stripe.invoices.sendInvoice(finalized.id!, { expand: ['lines'] })
}

export async function retrieveInvoice(
  stripe: Stripe,
  stripeInvoiceId: string,
): Promise<Stripe.Invoice> {
  return stripe.invoices.retrieve(stripeInvoiceId, { expand: ['lines'] })
}

/**
 * Removes an invoice from Stripe, by the only route Stripe allows for its state.
 *
 * A draft can be deleted outright. A finalized invoice cannot be — the client
 * may already hold the link — and is voided instead, which leaves it on record
 * marked uncollectable rather than pretending it never existed. Returns the
 * voided invoice, or null when it was deleted.
 */
export async function removeStripeInvoice(
  stripe: Stripe,
  stripeInvoiceId: string,
  status: string,
): Promise<Stripe.Invoice | null> {
  if (status === 'draft') {
    await stripe.invoices.del(stripeInvoiceId)
    return null
  }
  return stripe.invoices.voidInvoice(stripeInvoiceId, { expand: ['lines'] })
}

/**
 * Every invoice in the account, oldest first, streamed to a callback.
 *
 * `autoPagingEach` rather than collecting into an array: an account with years
 * of history would otherwise be held in memory all at once, and the caller
 * writes each row as it arrives anyway.
 *
 * The customer is expanded because a draft invoice has null `customer_name` and
 * `customer_email` — Stripe only copies those onto the invoice at finalization,
 * and without them a draft would import with no name and match no client.
 */
export async function eachInvoice(
  stripe: Stripe,
  onInvoice: (invoice: Stripe.Invoice) => Promise<void>,
): Promise<void> {
  await stripe.invoices
    .list({ limit: 100, expand: ['data.customer', 'data.lines'] })
    .autoPagingEach(async (invoice) => {
      await onInvoice(invoice)
    })
}

// ─── Lifecycle actions ────────────────────────────────────────────────────────

/**
 * Re-sends the invoice email — the "remind" button.
 *
 * Stripe's own reminder is the same call that delivered it the first time, so
 * this is `sendInvoice` again rather than a distinct endpoint. Only valid on an
 * open invoice: a draft has not been finalized, and a paid or voided one has
 * nothing to chase.
 */
export async function resendInvoice(
  stripe: Stripe,
  stripeInvoiceId: string,
): Promise<Stripe.Invoice> {
  return stripe.invoices.sendInvoice(stripeInvoiceId, { expand: ['lines'] })
}

/**
 * Records payment that happened outside Stripe — a bank transfer, a cheque.
 *
 * `paid_out_of_band` tells Stripe the money arrived without it processing a
 * charge, so it marks the invoice paid without trying to collect. Without this
 * flag the call would attempt to charge the customer's saved payment method,
 * which is emphatically not what "I already got paid" means.
 */
export async function payInvoiceOutOfBand(
  stripe: Stripe,
  stripeInvoiceId: string,
): Promise<Stripe.Invoice> {
  return stripe.invoices.pay(stripeInvoiceId, {
    paid_out_of_band: true,
    expand: ['lines'],
  })
}

/**
 * Writes the invoice off as never going to be paid.
 *
 * Distinct from voiding: void says the invoice should not have been issued,
 * uncollectible says it was issued correctly and the money is not coming. The
 * difference matters to an accountant, so both are offered.
 */
export async function markInvoiceUncollectible(
  stripe: Stripe,
  stripeInvoiceId: string,
): Promise<Stripe.Invoice> {
  return stripe.invoices.markUncollectible(stripeInvoiceId, { expand: ['lines'] })
}

/**
 * Updates the fields Stripe still allows once an invoice exists.
 *
 * Line items and amounts are deliberately absent. Stripe treats a finalized
 * invoice as an issued financial document and will not let its totals change —
 * the dashboard cannot do it either; it voids and reissues. Memo, footer,
 * purchase order and due date remain editable, which covers the corrections
 * people actually need after sending.
 */
export interface InvoiceEditableFields {
  notes?: string | null
  paymentTerms?: string | null
  purchaseOrder?: string | null
  dueDate?: Date | null
}

export async function updateStripeInvoice(
  stripe: Stripe,
  stripeInvoiceId: string,
  fields: InvoiceEditableFields,
): Promise<Stripe.Invoice> {
  const params: Stripe.InvoiceUpdateParams = { expand: ['lines'] }

  if (fields.notes !== undefined) params.description = fields.notes ?? ''
  if (fields.paymentTerms !== undefined) params.footer = fields.paymentTerms ?? ''
  if (fields.purchaseOrder !== undefined) {
    params.custom_fields = fields.purchaseOrder
      ? [{ name: 'PO Number', value: fields.purchaseOrder.slice(0, 30) }]
      : null
  }
  if (fields.dueDate !== undefined && fields.dueDate) {
    params.due_date = Math.floor(fields.dueDate.getTime() / 1000)
  }

  return stripe.invoices.update(stripeInvoiceId, params)
}

/** Convenience wrapper so callers do not each reach for the client module. */
export async function stripeFor(ownerId: string): Promise<Stripe> {
  return getStripeForOwner(ownerId)
}
