/**
 * Pure mapping between our invoice shape and Stripe's.
 *
 * No I/O: every function takes data and returns data, so the awkward parts
 * (money in cents, fractional hours against Stripe's integer quantities, a due
 * date expressed as a day count) are testable without a Stripe account. The
 * calls themselves live in stripe-invoices.ts.
 */

import type Stripe from 'stripe'
import type { LineItem, InvoiceStatus } from './types'

/** Dollars to cents, rounded to the nearest cent rather than truncated. */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

/** Cents to dollars. */
export function toDollars(cents: number): number {
  return Math.round(cents) / 100
}

// ─── Status ───────────────────────────────────────────────────────────────────

const STRIPE_STATUSES: readonly InvoiceStatus[] = [
  'draft',
  'open',
  'paid',
  'uncollectible',
  'void',
]

/**
 * Stripe's status, narrowed to the enum we store.
 *
 * Stripe types `status` as nullable and could add a value we do not know. An
 * unrecognised status is treated as `draft` — the only state with no financial
 * consequence — rather than guessed at, and never as `paid`.
 */
export function toInvoiceStatus(status: Stripe.Invoice['status']): InvoiceStatus {
  if (status && (STRIPE_STATUSES as readonly string[]).includes(status)) {
    return status as InvoiceStatus
  }
  return 'draft'
}

// ─── Line items ───────────────────────────────────────────────────────────────

/**
 * How a line reads on the invoice Stripe renders.
 *
 * Quantity and unit price are folded into the description rather than passed as
 * Stripe's `quantity` × `unit_amount`, because Stripe requires an integer
 * quantity and ours are hours — "2.5" is the normal case for a freelancer, and
 * rounding it would bill the client the wrong amount. The line carries its exact
 * total instead, with the arithmetic spelled out in words so the client can
 * still see how it was reached.
 */
export function lineItemDescription(item: LineItem): string {
  if (item.quantity === 1) return item.description

  const unit = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(item.unitPrice)

  // Trailing zeros on the quantity read badly: "2.5 × $80.00", not "2.50 ×".
  const qty = Number(item.quantity.toFixed(2)).toString()
  return `${item.description} (${qty} × ${unit})`
}

export interface InvoiceItemParams {
  amount: number       // cents
  currency: string
  description: string
}

/**
 * One Stripe invoice item per line, with the amounts already in cents.
 *
 * Zero-amount lines are kept: a line billed at no charge is a thing freelancers
 * deliberately show a client, and dropping it would silently edit the document.
 */
export function lineItemsToInvoiceItems(
  lineItems: readonly LineItem[],
  currency = 'usd',
): InvoiceItemParams[] {
  return lineItems.map((item) => ({
    amount: toCents(item.amount),
    currency,
    description: lineItemDescription(item),
  }))
}

/**
 * The line items Stripe reports back, in our shape, for the cached copy.
 *
 * Stripe has no notion of our quantity/unitPrice split once the line is folded
 * into a description, so both come back as a quantity of 1 at the line total.
 * The cache is for rendering a list, not for reconstructing the original entry —
 * the time entries the invoice was built from are still linked to it.
 */
export function stripeLinesToLineItems(invoice: Stripe.Invoice): LineItem[] {
  const lines = invoice.lines?.data ?? []
  return lines.map((line, index) => {
    const amount = toDollars(line.amount)
    return {
      id: line.id ?? `line-${index}`,
      description: line.description ?? '',
      quantity: 1,
      unitPrice: amount,
      amount,
    }
  })
}

// ─── Due date ─────────────────────────────────────────────────────────────────

/**
 * Whole days between issue and due, for Stripe's `days_until_due`.
 *
 * Stripe expresses payment terms as a day count from finalization rather than
 * as a date. Never negative: an invoice cannot be due before it is issued, and
 * Stripe rejects a negative count outright. Rounded up, so an invoice due
 * "tomorrow" does not become due today.
 */
export function daysUntilDue(issueDate: Date, dueDate: Date): number {
  const ms = dueDate.getTime() - issueDate.getTime()
  if (ms <= 0) return 0
  return Math.ceil(ms / 86_400_000)
}

// ─── Invoice → mirror row ─────────────────────────────────────────────────────

export interface InvoiceMirror {
  stripeInvoiceId: string
  stripeCustomerId: string | null
  /** Who Stripe says this is billed to, for invoices with no CRM client. */
  customerName: string | null
  customerEmail: string | null
  number: string | null
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
  status: InvoiceStatus
  lineItems: LineItem[]
  subtotal: number
  tax: number | null
  total: number
  issueDate: Date
  dueDate: Date | null
}

/**
 * The billing name and email on an invoice.
 *
 * Stripe fills `customer_name` / `customer_email` from the customer record at
 * finalization, but leaves them null on a draft — so an unfinalized invoice has
 * to be read through its expanded customer instead. Without this fallback, an
 * imported draft would show a blank row and match no client.
 */
export function invoiceCounterparty(invoice: Stripe.Invoice): {
  name: string | null
  email: string | null
} {
  const customer =
    invoice.customer && typeof invoice.customer === 'object'
      ? (invoice.customer as Stripe.Customer & { deleted?: boolean })
      : null

  const name =
    invoice.customer_name ??
    (customer && !customer.deleted ? customer.name ?? null : null)

  const email =
    invoice.customer_email ??
    (customer && !customer.deleted ? customer.email ?? null : null)

  return { name, email }
}

/**
 * The fields of our row that Stripe owns.
 *
 * Everything here is overwritten from Stripe on every create, send and webhook.
 * Deliberately excludes clientId, projectId and the time-entry links: those are
 * ours, Stripe has never heard of them, and a mirror update must not touch them.
 */
/**
 * Total tax on the invoice, in dollars, or null when none applies.
 *
 * Stripe reports tax as a list of components (`total_taxes`) rather than a
 * single figure — an invoice can carry several rates at once. Summing them is
 * the only way to get the one number our column holds. An empty or absent list
 * means no tax, which is not the same as zero tax and is stored as null.
 */
function totalTax(invoice: Stripe.Invoice): number | null {
  const taxes = invoice.total_taxes
  if (!taxes || taxes.length === 0) return null
  return toDollars(taxes.reduce((sum, t) => sum + t.amount, 0))
}

export function toInvoiceMirror(invoice: Stripe.Invoice): InvoiceMirror {
  const subtotal = toDollars(invoice.subtotal ?? 0)
  const tax = totalTax(invoice)
  // `total` is authoritative; falling back to subtotal + tax would disagree with
  // Stripe the moment a discount or credit is applied on their side.
  const total = toDollars(invoice.total ?? 0)

  const party = invoiceCounterparty(invoice)

  return {
    stripeInvoiceId: invoice.id!,
    stripeCustomerId:
      typeof invoice.customer === 'string'
        ? invoice.customer
        : (invoice.customer?.id ?? null),
    customerName: party.name,
    customerEmail: party.email,
    number: invoice.number ?? null,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
    status: toInvoiceStatus(invoice.status),
    lineItems: stripeLinesToLineItems(invoice),
    subtotal,
    tax,
    total,
    // `created` is always set; `due_date` is null on invoices Stripe charges
    // automatically rather than waiting on.
    issueDate: new Date(invoice.created * 1000),
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
  }
}

/**
 * The PaymentIntent that settled this invoice, when there is one.
 *
 * This is the key that stops an invoice payment being counted twice. A card
 * payment fires two webhooks for one movement of money — `charge.succeeded`,
 * which the finance sync records against the payment intent, and
 * `invoice.paid`, which lands in the invoice module. Recording the second
 * against the invoice id instead would put the same payment in Finance twice,
 * and an invoice payment is usually the largest number in the month.
 *
 * Keying both on the payment intent makes the unique
 * (ownerId, source, externalId) constraint resolve them to one row, whichever
 * event arrives first.
 *
 * Null for an invoice paid out of band (marked paid in the Stripe dashboard,
 * settled by bank transfer), which genuinely has no intent — those key on the
 * invoice id, and no charge event exists to collide with.
 */
export function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  for (const payment of invoice.payments?.data ?? []) {
    const intent = payment.payment?.payment_intent
    if (!intent) continue
    return typeof intent === 'string' ? intent : intent.id
  }
  return null
}

/**
 * Whether an invoice in this state has been settled.
 *
 * `paid` is the obvious one. A zero-total invoice Stripe marks paid on
 * finalization counts too, which is why this reads the status rather than
 * comparing amounts.
 */
export function isSettled(status: InvoiceStatus): boolean {
  return status === 'paid'
}

/**
 * Whether the invoice can still be edited.
 *
 * Only drafts. Once finalized, Stripe permits changing almost nothing — the
 * client may already be looking at the hosted page — so the UI must not offer
 * an edit that would fail at the API.
 */
export function isEditable(status: InvoiceStatus): boolean {
  return status === 'draft'
}
