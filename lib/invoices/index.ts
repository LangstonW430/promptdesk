import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db/client'
import { serializeInvoice, serializeInvoicePublic } from './serialize'
import type { CreateInvoiceInput, CreateFromEntriesInput } from './validators'
import type { LineItem } from './types'

const WITH_JOIN = {
  client:  { select: { companyName: true, contactName: true } },
  project: { select: { title: true } },
} as const

// ── Helpers ───────────────────────────────────────────────────────────────────

async function nextInvoiceNumber(ownerId: string): Promise<number> {
  const agg = await prisma.invoice.aggregate({
    where: { ownerId },
    _max: { invoiceNumber: true },
  })
  return (agg._max.invoiceNumber ?? 0) + 1
}

function calcTotals(lineItems: LineItem[], taxPct: number | null | undefined) {
  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0)
  const taxAmount = taxPct ? Math.round(subtotal * taxPct) / 100 : null
  const total = subtotal + (taxAmount ?? 0)
  return { subtotal, taxAmount, total }
}

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
  // `overdue` is derived in serializeInvoice — see the note there for why this
  // no longer writes to the database on a read path.
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

export async function getInvoiceByPublicToken(publicToken: string) {
  const row = await prisma.invoice.findUnique({
    where: { publicToken },
    include: {
      ...WITH_JOIN,
      owner: { select: { businessName: true, email: true } },
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

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createInvoice(ownerId: string, input: CreateInvoiceInput) {
  const { subtotal, taxAmount, total } = calcTotals(input.lineItems, input.tax)
  const invoiceNumber = await nextInvoiceNumber(ownerId)
  const publicToken = randomBytes(24).toString('hex')

  const row = await prisma.invoice.create({
    data: {
      ownerId,
      invoiceNumber,
      publicToken,
      clientId:   input.clientId,
      projectId:  input.projectId ?? null,
      lineItems:  input.lineItems,
      status:     'draft',
      issueDate:  new Date(input.issueDate),
      dueDate:    new Date(input.dueDate),
      subtotal,
      tax:        taxAmount,
      total,
      notes:      input.notes ?? null,
    },
    include: WITH_JOIN,
  })
  return serializeInvoice(row)
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
    const dateStr = e.date instanceof Date ? e.date.toISOString().slice(0, 10) : String(e.date).slice(0, 10)
    return {
      id: e.id,
      description: e.description
        ? `${dateStr}: ${e.description}`
        : dateStr,
      quantity: h,
      unitPrice: r,
      amount: Math.round(h * r * 100) / 100,
    }
  })

  const { subtotal, taxAmount, total } = calcTotals(lineItems, input.tax)
  if (total <= 0) throw new Error('Total is $0 — set a rate on each entry before invoicing')

  const invoiceNumber = await nextInvoiceNumber(ownerId)
  const publicToken = randomBytes(24).toString('hex')

  const projectId = entries[0].projectId ?? null

  // Creating the invoice and claiming its time entries has to be one unit: the
  // create used to sit alone inside `$transaction([...])` with the updateMany
  // issued separately afterwards, so a failure between the two (or a request
  // that died in the gap) left an invoice billing entries that were still
  // marked unbilled — free to be pulled onto a second invoice.
  const row = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        ownerId,
        invoiceNumber,
        publicToken,
        clientId,
        projectId,
        lineItems,
        status:    'draft',
        issueDate: new Date(input.issueDate),
        dueDate:   new Date(input.dueDate),
        subtotal,
        tax:       taxAmount,
        total,
        notes:     input.notes ?? null,
      },
      include: WITH_JOIN,
    })

    // Re-assert `invoiceId: null` so two concurrent calls cannot both claim the
    // same entries; the loser updates 0 rows and rolls back.
    const claimed = await tx.timeEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) }, ownerId, invoiceId: null },
      data: { invoiceId: invoice.id },
    })
    if (claimed.count !== entries.length) {
      throw new Error('Some entries were invoiced by another request — try again')
    }

    return invoice
  })

  return serializeInvoice(row)
}

export async function updateInvoiceStatus(
  ownerId: string,
  id: string,
  status: 'draft' | 'sent' | 'overdue',
) {
  const existing = await prisma.invoice.findFirst({ where: { id, ownerId } })
  if (!existing) return null
  if (existing.status === 'paid') throw new Error('Cannot change status of a paid invoice')

  const row = await prisma.invoice.update({
    where: { id },
    data: { status },
    include: WITH_JOIN,
  })
  return serializeInvoice(row)
}

export async function markInvoicePaid(ownerId: string, id: string) {
  const existing = await prisma.invoice.findFirst({
    where: { id, ownerId },
    include: { client: { select: { id: true, companyName: true, contactName: true } } },
  })
  if (!existing) return null
  if (existing.status === 'paid') throw new Error('Invoice is already paid')
  if (existing.transactionId) throw new Error('Invoice already has a linked transaction')

  const clientName = existing.client.companyName ?? existing.client.contactName ?? 'Client'
  const total = typeof existing.total === 'object' ? existing.total.toNumber() : Number(existing.total)
  const invoiceNumberFormatted = `INV-${String(existing.invoiceNumber).padStart(4, '0')}`

  const tx = await prisma.transaction.create({
    data: {
      ownerId,
      type:        'income',
      source:      'manual',
      amount:      total,
      currency:    'usd',
      description: `Payment for ${invoiceNumberFormatted} — ${clientName}`,
      category:    'Client work',
      occurredAt:  new Date(),
      clientId:    existing.clientId,
      isRecurring: false,
    },
  })

  const row = await prisma.invoice.update({
    where: { id },
    data: { status: 'paid', transactionId: tx.id },
    include: WITH_JOIN,
  })
  return serializeInvoice(row)
}

export async function markInvoicePaidFromCheckout(
  invoiceId: string,
  ownerId: string,
  paymentIntentId: string | null,
) {
  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, ownerId },
    include: { client: { select: { id: true, companyName: true, contactName: true } } },
  })
  if (!existing) return
  if (existing.status === 'paid') return
  if (existing.transactionId) return

  // Idempotency: if a stripe transaction already exists for this payment intent, link it
  if (paymentIntentId) {
    const existingTx = await prisma.transaction.findFirst({
      where: { ownerId, source: 'stripe', externalId: paymentIntentId },
    })
    if (existingTx) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'paid', transactionId: existingTx.id },
      })
      return
    }
  }

  const clientName = existing.client.companyName ?? existing.client.contactName ?? 'Client'
  const total = typeof existing.total === 'object' ? existing.total.toNumber() : Number(existing.total)
  const invoiceNumberFormatted = `INV-${String(existing.invoiceNumber).padStart(4, '0')}`

  const tx = await prisma.transaction.create({
    data: {
      ownerId,
      type:        'income',
      source:      'stripe',
      amount:      total,
      currency:    'usd',
      description: `Payment for ${invoiceNumberFormatted} — ${clientName}`,
      category:    'Client work',
      occurredAt:  new Date(),
      clientId:    existing.clientId,
      externalId:  paymentIntentId,
      externalType: 'payment_intent',
      isRecurring: false,
    },
  })

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'paid', transactionId: tx.id },
  })
}

/**
 * Archive or unarchive an invoice.
 *
 * Purely a visibility flag — unlike deletion, this is allowed for paid
 * invoices, which are the ones most worth filing away once settled. The
 * invoice keeps its number, its public token stays live for anyone holding
 * the link, and any linked transaction is untouched, the same way archiving a
 * client leaves their transactions in Finance.
 *
 * Returns null when the invoice does not belong to this owner.
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

export async function deleteInvoice(ownerId: string, id: string) {
  const existing = await prisma.invoice.findFirst({ where: { id, ownerId } })
  if (!existing) return false
  if (existing.status === 'paid') throw new Error('Cannot delete a paid invoice')

  // Unlink any time entries
  await prisma.timeEntry.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } })
  await prisma.invoice.delete({ where: { id } })
  return true
}
