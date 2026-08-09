export type LineItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export type SerializedInvoice = {
  id: string
  ownerId: string
  invoiceNumber: number
  invoiceNumberFormatted: string
  publicToken: string
  clientId: string
  clientName: string
  clientAddress: string | null
  projectId: string | null
  projectTitle: string | null
  lineItems: LineItem[]
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  subtotal: number
  tax: number | null
  /** The percentage behind `tax`; null on invoices raised before it was stored. */
  taxRate: number | null
  total: number
  /** e.g. "Net 30", frozen at creation. */
  paymentTerms: string | null
  /** The client's PO or reference. */
  purchaseOrder: string | null
  notes: string | null
  transactionId: string | null
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Everything the "From" block needs. Only the public view carries it — the
 * owner already knows who they are, and there is no reason to ship their own
 * billing details to their own browser on every list render.
 */
export type SerializedInvoicePublic = SerializedInvoice & {
  ownerBusinessName: string | null
  ownerEmail: string
  ownerAddress: string | null
  ownerPhone: string | null
  ownerTaxNumber: string | null
}
