export type LineItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

/**
 * Stripe's statuses. `open` is what used to be `sent`; `overdue` is no longer a
 * status at all but a derived property of an open invoice past its due date —
 * see `isOverdue` on the serialized shape.
 */
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'

export type SerializedInvoice = {
  id: string
  ownerId: string
  /** Stripe's invoice id. Null on legacy invoices raised before the move. */
  stripeInvoiceId: string | null
  /**
   * True for an invoice that predates Stripe invoicing. It is a record only:
   * it cannot be sent, paid or edited, because there is nothing in Stripe to
   * act on.
   */
  isLegacy: boolean
  /**
   * Stripe's number once finalized, or the legacy "INV-0001" for older rows.
   * Null while an invoice is still a draft — Stripe assigns it at finalization.
   */
  number: string | null
  /** Stripe's hosted payment page. This is the link to send the client. */
  hostedInvoiceUrl: string | null
  /** Stripe's rendered PDF. */
  invoicePdf: string | null
  /** Open and past its due date. Derived, never stored. */
  isOverdue: boolean
  /** Legacy public page token. Null for every Stripe-hosted invoice. */
  publicToken: string | null
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
 * Everything the "From" block needs.
 *
 * Only the legacy public view carries it. New invoices are rendered and hosted
 * by Stripe, which takes these details from the connected account rather than
 * from us.
 */
export type SerializedInvoicePublic = SerializedInvoice & {
  ownerBusinessName: string | null
  ownerEmail: string
  ownerAddress: string | null
  ownerPhone: string | null
  ownerTaxNumber: string | null
}
