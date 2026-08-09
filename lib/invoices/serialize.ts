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
  invoiceNumber: number
  publicToken: string
  clientId: string
  projectId: string | null
  lineItems: unknown
  status: string
  issueDate: Date | string
  dueDate: Date | string
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
  client: { companyName: string | null; contactName: string | null; address: string | null }
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

function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(4, '0')}`
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * `overdue` is derived at read time rather than persisted.
 *
 * It is purely a function of `status === 'sent'` and the due date having
 * passed, so writing it back to the database bought nothing and forced a write
 * transaction ahead of every invoice read. Deriving it also keeps the public
 * invoice page consistent with the owner's list — the old write-on-read only
 * ran on the authenticated paths, so a public invoice could still show "sent"
 * after its due date.
 *
 * A manually-set `overdue` status is preserved: this only ever promotes
 * `sent`, never demotes.
 */
function deriveStatus(status: string, dueDate: Date | string, now: Date): InvoiceStatus {
  if (status !== 'sent') return status as InvoiceStatus
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate)

  // A due date is a whole day, not an instant. `dueDate` is a Postgres DATE, so
  // it arrives as midnight UTC — comparing `due < now` marked an invoice
  // overdue at 00:00 on the very day it fell due, and a client opening the link
  // that morning saw a red OVERDUE chip on an invoice that was not yet late.
  return now.getTime() >= due.getTime() + ONE_DAY_MS ? 'overdue' : 'sent'
}

export function serializeInvoice(row: InvoiceRow, now: Date = new Date()): SerializedInvoice {
  return {
    id: row.id,
    ownerId: row.ownerId,
    invoiceNumber: row.invoiceNumber,
    invoiceNumberFormatted: formatInvoiceNumber(row.invoiceNumber),
    publicToken: row.publicToken,
    clientId: row.clientId,
    clientName: row.client.companyName ?? row.client.contactName ?? 'Unknown',
    clientAddress: row.client.address,
    projectId: row.projectId,
    projectTitle: row.project?.title ?? null,
    lineItems: row.lineItems as LineItem[],
    status: deriveStatus(row.status, row.dueDate, now),
    issueDate: toDateStr(row.issueDate),
    dueDate: toDateStr(row.dueDate),
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
