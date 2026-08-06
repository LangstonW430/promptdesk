import { describe, it, expect, beforeEach, vi } from 'vitest'

const timeEntryFindMany = vi.fn()
const timeEntryUpdateMany = vi.fn()
const invoiceCreate = vi.fn()
const invoiceAggregate = vi.fn()
const transaction = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    timeEntry: {
      get findMany() {
        return timeEntryFindMany
      },
      get updateMany() {
        return timeEntryUpdateMany
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
    get $transaction() {
      return transaction
    },
  },
}))

const { createInvoiceFromTimeEntries } = await import('@/lib/invoices')

const OWNER = 'owner-abc-123'

function entry(id: string) {
  return {
    id,
    hours: 2,
    rate: 100,
    date: new Date('2026-03-01T00:00:00Z'),
    description: 'Work',
    projectId: 'project-1',
    project: { client: { id: 'client-1' } },
  }
}

const INPUT = {
  entryIds: ['e1', 'e2'],
  issueDate: '2026-03-01',
  dueDate: '2026-03-31',
} as Parameters<typeof createInvoiceFromTimeEntries>[1]

describe('createInvoiceFromTimeEntries', () => {
  beforeEach(() => {
    timeEntryFindMany.mockReset()
    timeEntryUpdateMany.mockReset()
    invoiceCreate.mockReset()
    invoiceAggregate.mockReset()
    transaction.mockReset()

    timeEntryFindMany.mockResolvedValue([entry('e1'), entry('e2')])
    invoiceAggregate.mockResolvedValue({ _max: { invoiceNumber: 7 } })
    invoiceCreate.mockResolvedValue({
      id: 'invoice-1',
      invoiceNumber: 8,
      status: 'draft',
      total: 400,
      subtotal: 400,
      tax: null,
      lineItems: [],
      issueDate: new Date('2026-03-01T00:00:00Z'),
      dueDate: new Date('2026-03-31T00:00:00Z'),
      createdAt: new Date('2026-03-01T00:00:00Z'),
      updatedAt: new Date('2026-03-01T00:00:00Z'),
      client: { companyName: 'Acme', contactName: null },
      project: { title: 'Site' },
    })
    timeEntryUpdateMany.mockResolvedValue({ count: 2 })

    // Run the interactive callback against the same mocked delegates.
    transaction.mockImplementation((fn) =>
      fn({
        invoice: { create: invoiceCreate },
        timeEntry: { updateMany: timeEntryUpdateMany },
      }),
    )
  })

  it('creates the invoice and claims its entries inside one transaction', async () => {
    await createInvoiceFromTimeEntries(OWNER, INPUT)

    // Both writes must go through the interactive-transaction callback, not be
    // issued separately around it.
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(typeof transaction.mock.calls[0][0]).toBe('function')
    expect(invoiceCreate).toHaveBeenCalledTimes(1)
    expect(timeEntryUpdateMany).toHaveBeenCalledTimes(1)
  })

  it('only claims entries that are still unbilled', async () => {
    await createInvoiceFromTimeEntries(OWNER, INPUT)

    const where = timeEntryUpdateMany.mock.calls[0][0].where
    expect(where.invoiceId).toBeNull()
    expect(where.ownerId).toBe(OWNER)
    expect(where.id).toEqual({ in: ['e1', 'e2'] })
  })

  it('links the claimed entries to the invoice it just created', async () => {
    await createInvoiceFromTimeEntries(OWNER, INPUT)

    expect(timeEntryUpdateMany.mock.calls[0][0].data).toEqual({
      invoiceId: 'invoice-1',
    })
  })

  it('rolls back when another request claimed an entry first', async () => {
    // A concurrent invoice took one of the two entries between the read and
    // the write, so the guarded updateMany matches fewer rows than expected.
    timeEntryUpdateMany.mockResolvedValue({ count: 1 })

    await expect(createInvoiceFromTimeEntries(OWNER, INPUT)).rejects.toThrow(
      /another request/i,
    )
  })

  it('rejects entries spanning more than one client', async () => {
    timeEntryFindMany.mockResolvedValue([
      entry('e1'),
      { ...entry('e2'), project: { client: { id: 'client-2' } } },
    ])

    await expect(createInvoiceFromTimeEntries(OWNER, INPUT)).rejects.toThrow(
      /same client/i,
    )
  })
})
