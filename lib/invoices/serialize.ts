import type { SerializedInvoice, SerializedInvoicePublic, LineItem, InvoiceStatus } from './types'

type DecimalLike = { toNumber(): number } | number | null | undefined

function toNum(d: DecimalLike): number | null {
  if (d == null) return null
  if (typeof d === 'number') return d
  return d.toNumber()
}

function toDateStr(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  return String(d).slice(0, 10)
}

export type InvoiceRow = {
  id: string
  ownerId: string
  stripeInvoiceId: string | null
  number: string | null
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
  invoiceNumber: number | null
  publicToken: string | null
  clientId: string | null
  customerName: string | null
  customerEmail: string | null
  projectId: string | null
  lineItems: unknown
  status: string
  issueDate: Date | string
  dueDate: Date | string | null
  subtotal: DecimalLike
  tax: DecimalLike
  taxRate: DecimalLike
  total: DecimalLike
  paymentTerms: string | null
  purchaseOrder: string | null
  notes: string | null
  transactionId: string | null
  isArchived?: boolean
  createdAt: Date | string
  updatedAt: Date | string
  client: { companyName: string | null; contactName: string | null; address: string | null } | null
  project: { title: string } | null
}

export type InvoiceRowPublic = InvoiceRow & {
  owner: {
    businessName: string | null
    email: string
    businessAddress: string | null
    businessPhone: string | null
    taxNumber: string | null
  }
}

function formatLegacyNumber(n: number): string {
  return `INV-${String(n).padStart(4, '0')}`
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Overdue is derived at read time, and is no longer a status.
 *
 * Stripe's lifecycle has no overdue state — an unpaid invoice past its due date
 * is still `open` — so storing one would mean holding a status Stripe disagrees
 * with. It was always derived anyway: purely a function of the invoice being
 * unpaid and the due date having passed.
 *
 * A due date is a whole day, not an instant. `dueDate` is a Postgres DATE, so
 * it arrives as midnight UTC — comparing `due < now` would mark an invoice
 * overdue at 00:00 on the very day it falls due, and a client opening the link
 * that morning would see it flagged late when it is not.
 */
function deriveOverdue(
  status: string,
  dueDate: Date | string | null,
  now: Date,
): boolean {
  if (status !== 'open') return false
  // Stripe invoices that charge automatically carry no due date. Nothing is
  // being awaited, so nothing can be late.
  if (!dueDate) return false
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate)
  return now.getTime() >= due.getTime() + ONE_DAY_MS
}

export function serializeInvoice(row: InvoiceRow, now: Date = new Date()): SerializedInvoice {
  return {
    id: row.id,
    ownerId: row.ownerId,
    stripeInvoiceId: row.stripeInvoiceId,
    isLegacy: row.stripeInvoiceId == null,
    // Stripe's number once finalized; a draft has none yet. Legacy rows keep
    // showing the number our own counter gave them, so an invoice a client
    // already holds is still findable by the reference printed on it.
    number:
      row.number ??
      (row.invoiceNumber != null ? formatLegacyNumber(row.invoiceNumber) : null),
    hostedInvoiceUrl: row.hostedInvoiceUrl,
    invoicePdf: row.invoicePdf,
    isOverdue: deriveOverdue(row.status, row.dueDate, now),
    publicToken: row.publicToken,
    clientId: row.clientId,
    // An invoice raised in Stripe may be billed to somebody who is not in the
    // CRM. Stripe's own customer name is the fallback, so the row still says
    // who it is for; null only when Stripe had no name either.
    clientName:
      row.client?.companyName ??
      row.client?.contactName ??
      row.customerName ??
      null,
    clientEmail: row.customerEmail,
    clientAddress: row.client?.address ?? null,
    projectId: row.projectId,
    projectTitle: row.project?.title ?? null,
    lineItems: row.lineItems as LineItem[],
    status: row.status as InvoiceStatus,
    issueDate: toDateStr(row.issueDate),
    dueDate: row.dueDate ? toDateStr(row.dueDate) : null,
    subtotal: toNum(row.subtotal) ?? 0,
    tax: toNum(row.tax),
    taxRate: toNum(row.taxRate),
    total: toNum(row.total) ?? 0,
    paymentTerms: row.paymentTerms,
    purchaseOrder: row.purchaseOrder,
    notes: row.notes,
    transactionId: row.transactionId,
    isArchived: row.isArchived ?? false,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  }
}

export function serializeInvoicePublic(
  row: InvoiceRowPublic,
  now: Date = new Date(),
): SerializedInvoicePublic {
  return {
    ...serializeInvoice(row, now),
    ownerBusinessName: row.owner.businessName,
    ownerEmail: row.owner.email,
    ownerAddress: row.owner.businessAddress,
    ownerPhone: row.owner.businessPhone,
    ownerTaxNumber: row.owner.taxNumber,
  }
}
