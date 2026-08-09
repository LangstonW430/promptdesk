import { describe, it, expect, beforeEach, vi } from 'vitest'

const clientCount = vi.fn()
const projectCount = vi.fn()
const invoiceCreate = vi.fn()
const invoiceAggregate = vi.fn()
const userFindUnique = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: {
      get findUnique() {
        return userFindUnique
      },
    },
    client: {
      get count() {
        return clientCount
      },
    },
    project: {
      get count() {
        return projectCount
      },
    },
    invoice: {
      get create() {
        return invoiceCreate
      },
      get aggregate() {
        return invoiceAggregate
      },
    },
  },
}))

const { createInvoice } = await import('@/lib/invoices')

const OWNER = 'owner-abc'

const created = {
  id: 'i1',
  ownerId: OWNER,
  invoiceNumber: 1,
  publicToken: 'tok',
  clientId: 'c1',
  projectId: null,
  lineItems: [],
  status: 'draft',
  issueDate: new Date('2026-08-01'),
  dueDate: new Date('2026-08-31'),
  subtotal: 100,
  tax: 8,
  taxRate: 8,
  total: 108,
  paymentTerms: 'Net 30',
  purchaseOrder: null,
  notes: null,
  transactionId: null,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  client: { companyName: 'Acme', contactName: null, address: '1 Example St' },
  project: null,
}

const input = {
  clientId: 'c1',
  lineItems: [{ id: 'l1', description: 'Work', quantity: 1, unitPrice: 100, amount: 100 }],
  issueDate: '2026-08-01',
  dueDate: '2026-08-31',
}

const dataOf = () => invoiceCreate.mock.calls[0][0].data

beforeEach(() => {
  clientCount.mockReset().mockResolvedValue(1)
  projectCount.mockReset().mockResolvedValue(1)
  invoiceCreate.mockReset().mockResolvedValue(created)
  invoiceAggregate.mockReset().mockResolvedValue({ _max: { invoiceNumber: 0 } })
  userFindUnique.mockReset().mockResolvedValue({ defaultPaymentTerms: null })
})

describe('createInvoice — tax rate', () => {
  it('stores the rate alongside the amount', async () => {
    await createInvoice(OWNER, { ...input, tax: 8.5 })

    const data = dataOf()
    // Both, not either: the amount cannot be read back into a rate, and the
    // rate alone does not survive a change to the subtotal.
    expect(data.taxRate).toBe(8.5)
    expect(data.tax).toBe(8.5)
  })

  it('leaves the rate null when no tax is charged', async () => {
    await createInvoice(OWNER, input)

    expect(dataOf().taxRate).toBeNull()
    expect(dataOf().tax).toBeNull()
  })
})

describe('createInvoice — payment terms', () => {
  it("falls back to the owner's default when none is supplied", async () => {
    userFindUnique.mockResolvedValue({ defaultPaymentTerms: 'Net 14' })

    await createInvoice(OWNER, input)
    expect(dataOf().paymentTerms).toBe('Net 14')
  })

  it('prefers terms supplied with the invoice', async () => {
    userFindUnique.mockResolvedValue({ defaultPaymentTerms: 'Net 14' })

    await createInvoice(OWNER, { ...input, paymentTerms: 'Due on receipt' })
    expect(dataOf().paymentTerms).toBe('Due on receipt')
    // The default is not consulted at all when the caller has an opinion.
    expect(userFindUnique).not.toHaveBeenCalled()
  })

  it('honours an explicit null rather than substituting the default', async () => {
    userFindUnique.mockResolvedValue({ defaultPaymentTerms: 'Net 14' })

    await createInvoice(OWNER, { ...input, paymentTerms: null })
    expect(dataOf().paymentTerms).toBeNull()
  })

  it('copes with an owner who has set no default', async () => {
    await createInvoice(OWNER, input)
    expect(dataOf().paymentTerms).toBeNull()
  })
})

describe('createInvoice — purchase order', () => {
  it('stores the reference when given', async () => {
    await createInvoice(OWNER, { ...input, purchaseOrder: 'PO-4471' })
    expect(dataOf().purchaseOrder).toBe('PO-4471')
  })

  it('stores null when not given', async () => {
    await createInvoice(OWNER, input)
    expect(dataOf().purchaseOrder).toBeNull()
  })
})
