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
  projectId: string | null
  projectTitle: string | null
  lineItems: LineItem[]
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  subtotal: number
  tax: number | null
  total: number
  notes: string | null
  transactionId: string | null
  createdAt: string
  updatedAt: string
}

export type SerializedInvoicePublic = SerializedInvoice & {
  ownerBusinessName: string | null
  ownerEmail: string
}
