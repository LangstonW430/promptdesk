/**
 * Invoicing, on top of Stripe.
 *
 * Stripe is the system of record. It assigns the number, hosts the page the
 * client pays on, renders the PDF, sends the email and chases the payment. What
 * lives here is a mirror row holding the things Stripe has never heard of —
 * which client, which project, which time entries — plus a cached copy of the
 * amounts so a list page does not need one API call per invoice.
 *
 * The ordering rule throughout: **Stripe first, then the mirror.** If the
 * mirror write fails after Stripe succeeded, the worst case is an orphaned
 * draft in the Stripe dashboard, which is visible and harmless. The other order
 * would show the user an invoice that does not exist and cannot be paid.
 *
 * Rows created before this move have a null `stripeInvoiceId`. They stay
 * readable as records but cannot be sent, paid or edited, because there is
 * nothing in Stripe to act on.
 */

import { prisma } from '@/lib/db/client'
import { ownsClient, ownsProject } from '@/lib/db/ownership'
import { serializeInvoice, serializeInvoicePublic } from './serialize'
import {
  stripeFor,
  ensureStripeCustomer,
  createStripeInvoice,
  finalizeAndSendInvoice,
  retrieveInvoice,
  removeStripeInvoice,
  describeStripeError,
} from './stripe-invoices'
import { toInvoiceMirror, isEditable, invoicePaymentIntentId } from './stripe-mapper'
import type { CreateInvoiceInput, CreateFromEntriesInput } from './validators'
import type { LineItem } from './types'

const WITH_JOIN = {
  client:  { select: { companyName: true, contactName: true, address: true } },
  project: { select: { title: true } },
} as const

// ── Queries ───────────────────────────────────────────────────────────────────

export interface ListInvoicesFilters {
  /** Return archived invoices instead of active ones. Defaults to false. */
  archived?: boolean
}

export async function listInvoices(
  ownerId: string,
  filters: ListInvoicesFilters = {},
) {
  const rows = await prisma.invoice.findMany({
    where: { ownerId, isArchived: filters.archived ?? false },
    include: WITH_JOIN,
    orderBy: { createdAt: 'desc' },
  })
  const now = new Date()
  return rows.map((row) => serializeInvoice(row, now))
}

export async function getInvoice(ownerId: string, id: string) {
  const row = await prisma.invoice.findFirst({
    where: { id, ownerId },
    include: WITH_JOIN,
  })
  if (!row) return null
  return serializeInvoice(row)
}

/**
 * A legacy invoice by its public token.
 *
 * Only legacy rows have a token: Stripe hosts the page for everything raised
 * since. Kept so links already in clients' inboxes still resolve to the
 * document they were sent, rather than 404ing the moment this shipped.
 */
export async function getInvoiceByPublicToken(publicToken: string) {
  const row = await prisma.invoice.findUnique({
    where: { publicToken },
    include: {
      ...WITH_JOIN,
      owner: {
        select: {
          businessName: true,
          email: true,
          businessAddress: true,
          businessPhone: true,
          taxNumber: true,
        },
      },
    },
  })
  if (!row) return null
  return serializeInvoicePublic(row)
}

// See lib/finance/index.ts — single definition lives in lib/clients.
export { listClientOptions as fetchClientsForPicker } from '@/lib/clients'

export async function fetchProjectsForPicker(ownerId: string, clientId: string) {
  const rows = await prisma.project.findMany({
    where: { ownerId, clientId, status: 'active', isArchived: false },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  })
  return rows
}

export async function fetchBillableEntries(ownerId: string, entryIds: string[]) {
  const rows = await prisma.timeEntry.findMany({
    where: { id: { in: entryIds }, ownerId, isBillable: true, invoiceId: null },
    include: {
      project: {
        select: {
          id:     true,
          title:  true,
          client: { select: { id: true, companyName: true, contactName: true } },
        },
      },
    },
    orderBy: [{ date: 'asc' }],
  })
  return rows
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * The payment terms an invoice is created under.
 *
 * Copied from the user's default rather than read through at display time: an
 * invoice must always state the terms it was actually sent under, so changing
 * the default later cannot rewrite what a client already has.
 */
async function termsFor(
  ownerId: string,
  supplied: string | null | undefined,
): Promise<string | null> {
  if (supplied !== undefined) return supplied
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { defaultPaymentTerms: true },
  })
  return user?.defaultPaymentTerms ?? null
}

/** Sum of the line amounts, for the pre-flight check before calling Stripe. */
function sumLines(lineItems: readonly LineItem[]): number {
  return lineItems.reduce((s, li) => s + li.amount, 0)
}

// ── Mutations ─────────────────────────────────────────────────────────────────

interface DraftInput {
  clientId: string
  projectId: string | null
  lineItems: LineItem[]
  issueDate: string
  dueDate: string
  tax?: number | null
  notes?: string | null
  paymentTerms?: string | null
  purchaseOrder?: string | null
}

/**
 * Raises a draft invoice in Stripe and mirrors it.
 *
 * Shared by both entry points so the manual builder and the time-entry
 * conversion cannot drift apart in what they send Stripe. `claimEntryIds`, when
 * given, marks those time entries as billed in the same database transaction as
 * the mirror insert.
 */
async function createDraft(
  ownerId: string,
  input: DraftInput,
  claimEntryIds?: string[],
) {
  const issueDate = new Date(input.issueDate)
  const dueDate = new Date(input.dueDate)
  const terms = await termsFor(ownerId, input.paymentTerms)

  const stripe = await stripeFor(ownerId)
  const customerId = await ensureStripeCustomer(stripe, ownerId, input.clientId)

  const stripeInvoice = await createStripeInvoice(stripe, {
    customerId,
    lineItems: input.lineItems,
    issueDate,
    dueDate,
    taxRate: input.tax ?? null,
    notes: input.notes ?? null,
    paymentTerms: terms,
    purchaseOrder: input.purchaseOrder ?? null,
    // Carried on the Stripe object so a webhook can find our row directly.
    // Without it the handler would have to keep a lookup table in step with
    // Stripe, and a missed write there would silently drop payment updates.
    metadata: { promptdeskOwnerId: ownerId },
  })

  const mirror = toInvoiceMirror(stripeInvoice)

  const row = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        ownerId,
        stripeInvoiceId:  mirror.stripeInvoiceId,
        stripeCustomerId: mirror.stripeCustomerId,
        number:           mirror.number,
        hostedInvoiceUrl: mirror.hostedInvoiceUrl,
        invoicePdf:       mirror.invoicePdf,
        clientId:         input.clientId,
        projectId:        input.projectId,
        lineItems:        mirror.lineItems,
        status:           mirror.status,
        issueDate,
        dueDate:          mirror.dueDate ?? dueDate,
        subtotal:         mirror.subtotal,
        tax:              mirror.tax,
        taxRate:          input.tax ?? null,
        total:            mirror.total,
        paymentTerms:     terms,
        purchaseOrder:    input.purchaseOrder ?? null,
        notes:            input.notes ?? null,
      },
      include: WITH_JOIN,
    })

    if (claimEntryIds?.length) {
      // Re-assert `invoiceId: null` so two concurrent calls cannot both claim
      // the same entries; the loser updates fewer rows and rolls back.
      const claimed = await tx.timeEntry.updateMany({
        where: { id: { in: claimEntryIds }, ownerId, invoiceId: null },
        data: { invoiceId: invoice.id },
      })
      if (claimed.count !== claimEntryIds.length) {
        throw new Error('Some entries were invoiced by another request — try again')
      }
    }

    return invoice
  })

  return serializeInvoice(row)
}

export async function createInvoice(ownerId: string, input: CreateInvoiceInput) {
  // clientId and projectId arrive from the request body. Unchecked, an invoice
  // could be raised against another owner's client — and Stripe would email it
  // to them.
  if (!(await ownsClient(ownerId, input.clientId))) {
    throw new Error('Client not found')
  }
  if (input.projectId && !(await ownsProject(ownerId, input.projectId, input.clientId))) {
    throw new Error('Project not found for this client')
  }
  if (sumLines(input.lineItems) <= 0) {
    throw new Error('Invoice total must be greater than $0')
  }

  return createDraft(ownerId, {
    clientId:      input.clientId,
    projectId:     input.projectId ?? null,
    lineItems:     input.lineItems,
    issueDate:     input.issueDate,
    dueDate:       input.dueDate,
    tax:           input.tax,
    notes:         input.notes,
    paymentTerms:  input.paymentTerms,
    purchaseOrder: input.purchaseOrder,
  })
}

export async function createInvoiceFromTimeEntries(
  ownerId: string,
  input: CreateFromEntriesInput,
) {
  const entries = await fetchBillableEntries(ownerId, input.entryIds)
  if (entries.length === 0) throw new Error('No unbilled billable entries found')

  const clientId = entries[0].project.client.id
  const clientSame = entries.every((e) => e.project.client.id === clientId)
  if (!clientSame) throw new Error('All entries must belong to the same client')

  const lineItems: LineItem[] = entries.map((e) => {
    const h = typeof e.hours === 'object' ? e.hours.toNumber() : Number(e.hours)
    const r = e.rate != null
      ? (typeof e.rate === 'object' ? e.rate.toNumber() : Number(e.rate))
      : 0
    const dateStr = e.date instanceof Date
      ? e.date.toISOString().slice(0, 10)
      : String(e.date).slice(0, 10)
    return {
      id: e.id,
      description: e.description ? `${dateStr}: ${e.description}` : dateStr,
      quantity: h,
      unitPrice: r,
      amount: Math.round(h * r * 100) / 100,
    }
  })

  if (sumLines(lineItems) <= 0) {
    throw new Error('Total is $0 — set a rate on each entry before invoicing')
  }

  return createDraft(
    ownerId,
    {
      clientId,
      projectId:     entries[0].projectId ?? null,
      lineItems,
      issueDate:     input.issueDate,
      dueDate:       input.dueDate,
      tax:           input.tax,
      notes:         input.notes,
      paymentTerms:  input.paymentTerms,
      purchaseOrder: input.purchaseOrder,
    },
    entries.map((e) => e.id),
  )
}

/**
 * Finalizes the invoice in Stripe and emails it to the client.
 *
 * This is the only "send" there is now — Stripe delivers it, and the link in
 * that email is Stripe's hosted page. Replaces the old status flip to `sent`,
 * which only ever changed a value in our own database and left the operator to
 * email the invoice themselves.
 */
export async function sendInvoice(ownerId: string, id: string) {
  const existing = await prisma.invoice.findFirst({
    where: { id, ownerId },
    select: { stripeInvoiceId: true, status: true },
  })
  if (!existing) return null
  if (!existing.stripeInvoiceId) {
    throw new Error(
      'This invoice predates the Stripe integration and cannot be sent. ' +
        'Raise a new one to bill through Stripe.',
    )
  }
  if (existing.status !== 'draft') {
    throw new Error('This invoice has already been finalized')
  }

  const stripe = await stripeFor(ownerId)
  const sent = await finalizeAndSendInvoice(stripe, existing.stripeInvoiceId)
  return applyMirror(id, sent)
}

/**
 * Re-reads an invoice from Stripe and updates the mirror.
 *
 * The webhook is the normal path; this is the manual one, for when an invoice
 * was changed in the Stripe dashboard or a webhook was missed. Cheap enough to
 * offer as a button and safe to run at any time.
 */
export async function refreshInvoice(ownerId: string, id: string) {
  const existing = await prisma.invoice.findFirst({
    where: { id, ownerId },
    select: { stripeInvoiceId: true },
  })
  if (!existing?.stripeInvoiceId) return null

  const stripe = await stripeFor(ownerId)
  const fresh = await retrieveInvoice(stripe, existing.stripeInvoiceId)
  return applyMirror(id, fresh)
}

/**
 * Writes Stripe's copy of an invoice over ours.
 *
 * Only ever touches the fields Stripe owns. clientId, projectId, the time-entry
 * links and the archive flag are ours and are never overwritten from a Stripe
 * payload — Stripe does not know what they should be.
 */
async function applyMirror(
  id: string,
  stripeInvoice: Parameters<typeof toInvoiceMirror>[0],
) {
  const mirror = toInvoiceMirror(stripeInvoice)
  const row = await prisma.invoice.update({
    where: { id },
    data: {
      number:           mirror.number,
      hostedInvoiceUrl: mirror.hostedInvoiceUrl,
      invoicePdf:       mirror.invoicePdf,
      status:           mirror.status,
      lineItems:        mirror.lineItems,
      subtotal:         mirror.subtotal,
      tax:              mirror.tax,
      total:            mirror.total,
      ...(mirror.dueDate && { dueDate: mirror.dueDate }),
    },
    include: WITH_JOIN,
  })
  return serializeInvoice(row)
}

/**
 * Records payment of an invoice, from the Stripe webhook.
 *
 * Creates the income transaction as well as updating the status, so a paid
 * invoice shows up in Finance attributed to the right client and project.
 *
 * Returns true when this was one of our invoices, so the caller knows not to
 * also run the generic finance import over the same event.
 *
 * Idempotent on every path Stripe can retry:
 *   - an invoice already carrying a transaction is left alone
 *   - the income row keys on the PaymentIntent that settled it, which is the
 *     same key `charge.succeeded` uses, so the two webhooks Stripe sends for
 *     one card payment resolve to a single row whichever arrives first
 *   - an out-of-band payment has no intent and keys on the invoice id, where
 *     no charge event exists to collide with
 */
export async function markInvoicePaidFromStripe(
  ownerId: string,
  stripeInvoiceId: string,
  stripeInvoice: Parameters<typeof toInvoiceMirror>[0],
): Promise<boolean> {
  const existing = await prisma.invoice.findFirst({
    where: { stripeInvoiceId, ownerId },
    include: { client: { select: { companyName: true, contactName: true } } },
  })
  if (!existing) return false

  const mirror = toInvoiceMirror(stripeInvoice)

  await prisma.invoice.update({
    where: { id: existing.id },
    data: {
      number:           mirror.number,
      hostedInvoiceUrl: mirror.hostedInvoiceUrl,
      invoicePdf:       mirror.invoicePdf,
      status:           mirror.status,
      lineItems:        mirror.lineItems,
      subtotal:         mirror.subtotal,
      tax:              mirror.tax,
      total:            mirror.total,
    },
  })

  if (mirror.status !== 'paid') return true
  if (existing.transactionId) return true

  const clientName =
    existing.client.companyName ?? existing.client.contactName ?? 'Client'
  const reference = mirror.number ?? stripeInvoiceId

  // The same key charge.succeeded uses, so one payment cannot become two rows.
  const externalId = invoicePaymentIntentId(stripeInvoice) ?? stripeInvoiceId

  const alreadyImported = await prisma.transaction.findFirst({
    where: { ownerId, source: 'stripe', externalId },
    select: { id: true },
  })
  if (alreadyImported) {
    // charge.succeeded got here first. Attribute it to the client and the
    // project the invoice was raised for — the charge sync only knows the
    // counterparty email, so this is strictly better information.
    await prisma.transaction.update({
      where: { id: alreadyImported.id },
      data: {
        clientId:  existing.clientId,
        projectId: existing.projectId,
      },
    })
    await prisma.invoice.update({
      where: { id: existing.id },
      data: { transactionId: alreadyImported.id },
    })
    return true
  }

  const tx = await prisma.transaction.create({
    data: {
      ownerId,
      type:         'income',
      source:       'stripe',
      amount:       mirror.total,
      currency:     'usd',
      description:  `Payment for ${reference} — ${clientName}`,
      category:     'Client work',
      occurredAt:   new Date(),
      clientId:     existing.clientId,
      projectId:    existing.projectId,
      externalId,
      externalType: 'invoice',
      isRecurring:  false,
    },
  })

  await prisma.invoice.update({
    where: { id: existing.id },
    data: { transactionId: tx.id },
  })

  return true
}

/**
 * Updates the mirror from any non-payment invoice webhook.
 *
 * Finalization, sending, voiding and write-off all just move the status and the
 * hosted URLs, none of which touch Finance.
 */
export async function syncInvoiceFromStripe(
  ownerId: string,
  stripeInvoiceId: string,
  stripeInvoice: Parameters<typeof toInvoiceMirror>[0],
): Promise<void> {
  const existing = await prisma.invoice.findFirst({
    where: { stripeInvoiceId, ownerId },
    select: { id: true },
  })
  if (!existing) return
  await applyMirror(existing.id, stripeInvoice)
}

/**
 * Archive or unarchive an invoice.
 *
 * Purely a visibility flag in our list — unlike deletion, allowed for paid
 * invoices, which are the ones most worth filing away once settled. Nothing is
 * sent to Stripe: the invoice is still live there, its hosted link still works,
 * and any linked transaction is untouched.
 */
export async function setInvoiceArchived(
  ownerId: string,
  id: string,
  archived: boolean,
) {
  const count = await prisma.invoice.count({ where: { id, ownerId } })
  if (count === 0) return null

  const row = await prisma.invoice.update({
    where: { id },
    data: { isArchived: archived },
    include: WITH_JOIN,
  })
  return serializeInvoice(row)
}

/**
 * Deletes a draft, or voids a finalized invoice.
 *
 * Which one happens is Stripe's rule, not ours: a draft can be deleted
 * outright, a finalized invoice cannot be, because the client may already hold
 * the link. Voiding leaves it on record, marked void, and the mirror row stays
 * with it — deleting our copy of an invoice that still exists in Stripe would
 * mean the next webhook had nothing to update.
 *
 * Returns 'deleted' or 'voided' so the caller can say which happened.
 */
export async function deleteInvoice(
  ownerId: string,
  id: string,
): Promise<'deleted' | 'voided' | null> {
  const existing = await prisma.invoice.findFirst({
    where: { id, ownerId },
    select: { stripeInvoiceId: true, status: true },
  })
  if (!existing) return null
  if (existing.status === 'paid') throw new Error('Cannot delete a paid invoice')

  // Legacy rows have nothing in Stripe, so the old behaviour still applies.
  if (!existing.stripeInvoiceId) {
    await prisma.timeEntry.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } })
    await prisma.invoice.delete({ where: { id } })
    return 'deleted'
  }

  const stripe = await stripeFor(ownerId)
  const voided = await removeStripeInvoice(
    stripe,
    existing.stripeInvoiceId,
    existing.status,
  )

  if (!voided) {
    await prisma.timeEntry.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } })
    await prisma.invoice.delete({ where: { id } })
    return 'deleted'
  }

  // Voided, not gone: the entries stay attached, because they really were
  // billed on a document the client may have seen.
  await applyMirror(id, voided)
  return 'voided'
}

export { describeStripeError, isEditable }
