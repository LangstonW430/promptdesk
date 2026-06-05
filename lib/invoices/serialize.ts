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
  total: DecimalLike
  notes: string | null
  transactionId: string | null
  createdAt: Date | string
  updatedAt: Date | string
  client: { companyName: string | null; contactName: string | null }
  project: { title: string } | null
}

export type InvoiceRowPublic = InvoiceRow & {
  owner: { businessName: string | null; email: string }
}

function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(4, '0')}`
}

export function serializeInvoice(row: InvoiceRow): SerializedInvoice {
  return {
    id: row.id,
    ownerId: row.ownerId,
    invoiceNumber: row.invoiceNumber,
    invoiceNumberFormatted: formatInvoiceNumber(row.invoiceNumber),
    publicToken: row.publicToken,
    clientId: row.clientId,
    clientName: row.client.companyName ?? row.client.contactName ?? 'Unknown',
    projectId: row.projectId,
    projectTitle: row.project?.title ?? null,
    lineItems: row.lineItems as LineItem[],
    status: row.status as InvoiceStatus,
    issueDate: toDateStr(row.issueDate),
    dueDate: toDateStr(row.dueDate),
    subtotal: toNum(row.subtotal) ?? 0,
    tax: toNum(row.tax),
    total: toNum(row.total) ?? 0,
    notes: row.notes,
    transactionId: row.transactionId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  }
}

export function serializeInvoicePublic(row: InvoiceRowPublic): SerializedInvoicePublic {
  return {
    ...serializeInvoice(row),
    ownerBusinessName: row.owner.businessName,
    ownerEmail: row.owner.email,
  }
}
