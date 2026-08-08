import { describe, it, expect, beforeEach, vi } from 'vitest'

const clientCount = vi.fn()
const projectCount = vi.fn()
const invoiceCreate = vi.fn()
const invoiceAggregate = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
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
  dueDate: new Date('2026-08-15'),
  subtotal: 100,
  tax: null,
  total: 100,
  notes: null,
  transactionId: null,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  client: { companyName: 'Acme', contactName: null },
  project: null,
}

const input = {
  clientId: 'c1',
  lineItems: [{ id: 'l1', description: 'Work', quantity: 1, unitPrice: 100, amount: 100 }],
  issueDate: '2026-08-01',
  dueDate: '2026-08-15',
}

beforeEach(() => {
  clientCount.mockReset().mockResolvedValue(1)
  projectCount.mockReset().mockResolvedValue(1)
  invoiceCreate.mockReset().mockResolvedValue(created)
  invoiceAggregate.mockReset().mockResolvedValue({ _max: { invoiceNumber: 0 } })
})

describe('createInvoice — relation ownership', () => {
  it('creates the invoice when the client belongs to the owner', async () => {
    await createInvoice(OWNER, input)
    expect(invoiceCreate).toHaveBeenCalled()
  })

  it("refuses another owner's client", async () => {
    // Both the invoice list and the public invoice page render the joined
    // client's name, so an unchecked id here was a way to read it.
    clientCount.mockResolvedValue(0)

    await expect(
      createInvoice(OWNER, { ...input, clientId: 'someone-elses' }),
    ).rejects.toThrow('Client not found')
    expect(invoiceCreate).not.toHaveBeenCalled()
  })

  it('refuses a project belonging to a different client', async () => {
    projectCount.mockResolvedValue(0)

    await expect(
      createInvoice(OWNER, { ...input, projectId: 'p-of-c2' }),
    ).rejects.toThrow('Project not found for this client')
    expect(invoiceCreate).not.toHaveBeenCalled()
  })

  it('checks the project against the invoice’s client', async () => {
    await createInvoice(OWNER, { ...input, projectId: 'p1' })

    expect(projectCount.mock.calls[0][0].where).toEqual({
      id: 'p1',
      ownerId: OWNER,
      clientId: 'c1',
    })
  })

  it('skips the project check when the invoice has no project', async () => {
    await createInvoice(OWNER, input)
    expect(projectCount).not.toHaveBeenCalled()
  })
})
