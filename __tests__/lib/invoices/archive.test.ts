import { describe, it, expect, beforeEach, vi } from 'vitest'

const invoiceFindMany = vi.fn()
const invoiceCount = vi.fn()
const invoiceUpdate = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    invoice: {
      get findMany() {
        return invoiceFindMany
      },
      get count() {
        return invoiceCount
      },
      get update() {
        return invoiceUpdate
      },
    },
  },
}))

const { listInvoices, setInvoiceArchived } = await import('@/lib/invoices')

const OWNER = 'owner-abc-123'
const INVOICE = 'invoice-def-456'

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE,
    ownerId: OWNER,
    invoiceNumber: 8,
    publicToken: 'tok',
    clientId: 'client-1',
    projectId: null,
    lineItems: [],
    status: 'paid',
    issueDate: new Date('2026-03-01T00:00:00Z'),
    dueDate: new Date('2026-03-31T00:00:00Z'),
    subtotal: 400,
    tax: null,
    total: 400,
    notes: null,
    transactionId: 'tx-1',
    isArchived: false,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    client: { companyName: 'Acme', contactName: null },
    project: null,
    ...overrides,
  }
}

describe('listInvoices archive filter', () => {
  beforeEach(() => {
    invoiceFindMany.mockReset()
    invoiceFindMany.mockResolvedValue([])
  })

  it('returns only active invoices by default', async () => {
    await listInvoices(OWNER)

    expect(invoiceFindMany.mock.calls[0][0].where).toEqual({
      ownerId: OWNER,
      isArchived: false,
    })
  })

  it('returns only archived invoices when asked', async () => {
    await listInvoices(OWNER, { archived: true })

    expect(invoiceFindMany.mock.calls[0][0].where).toEqual({
      ownerId: OWNER,
      isArchived: true,
    })
  })

  it('surfaces isArchived on the serialized row', async () => {
    invoiceFindMany.mockResolvedValue([row({ isArchived: true })])

    const [invoice] = await listInvoices(OWNER, { archived: true })
    expect(invoice.isArchived).toBe(true)
  })
})

describe('setInvoiceArchived', () => {
  beforeEach(() => {
    invoiceCount.mockReset()
    invoiceUpdate.mockReset()
    invoiceCount.mockResolvedValue(1)
    invoiceUpdate.mockResolvedValue(row({ isArchived: true }))
  })

  it('refuses to touch an invoice belonging to another owner', async () => {
    invoiceCount.mockResolvedValue(0)

    await expect(setInvoiceArchived(OWNER, INVOICE, true)).resolves.toBeNull()
    expect(invoiceUpdate).not.toHaveBeenCalled()
  })

  it('scopes the ownership check to the owner', async () => {
    await setInvoiceArchived(OWNER, INVOICE, true)

    expect(invoiceCount.mock.calls[0][0].where).toEqual({
      id: INVOICE,
      ownerId: OWNER,
    })
  })

  it('sets the flag without touching status or the linked transaction', async () => {
    await setInvoiceArchived(OWNER, INVOICE, true)

    const arg = invoiceUpdate.mock.calls[0][0]
    expect(arg.where).toEqual({ id: INVOICE })
    // Archiving is a visibility flag only — writing status here would clobber
    // the paid/draft distinction the list still needs to render.
    expect(arg.data).toEqual({ isArchived: true })
  })

  it('archives a paid invoice, which deletion refuses to do', async () => {
    // Settled invoices are the ones most worth filing away, so unlike
    // deleteInvoice this path must not reject on status === 'paid'.
    invoiceUpdate.mockResolvedValue(row({ status: 'paid', isArchived: true }))

    const result = await setInvoiceArchived(OWNER, INVOICE, true)
    expect(result?.isArchived).toBe(true)
    expect(result?.status).toBe('paid')
  })

  it('restores by clearing the flag', async () => {
    invoiceUpdate.mockResolvedValue(row({ isArchived: false }))

    await setInvoiceArchived(OWNER, INVOICE, false)
    expect(invoiceUpdate.mock.calls[0][0].data).toEqual({ isArchived: false })
  })
})
