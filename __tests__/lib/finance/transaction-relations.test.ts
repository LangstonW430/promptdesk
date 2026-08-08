import { describe, it, expect, beforeEach, vi } from 'vitest'

const clientCount = vi.fn()
const projectCount = vi.fn()
const transactionCreate = vi.fn()
const transactionUpdate = vi.fn()
const transactionFindFirst = vi.fn()

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
    transaction: {
      get create() {
        return transactionCreate
      },
      get update() {
        return transactionUpdate
      },
      get findFirst() {
        return transactionFindFirst
      },
    },
  },
}))

const { createTransaction, updateTransaction } = await import('@/lib/finance')

const OWNER = 'owner-abc'

const row = {
  id: 't1',
  ownerId: OWNER,
  type: 'income',
  source: 'manual',
  amount: 100,
  currency: 'usd',
  description: null,
  category: 'Client work',
  occurredAt: new Date('2026-08-01T00:00:00.000Z'),
  clientId: null,
  projectId: null,
  externalId: null,
  externalType: null,
  isRecurring: false,
  frequency: null,
  recurrenceEndedAt: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
}

const input = {
  type: 'income' as const,
  amount: 100,
  currency: 'usd',
  category: 'Client work',
  occurredAt: '2026-08-01',
  isRecurring: false,
}

beforeEach(() => {
  clientCount.mockReset().mockResolvedValue(1)
  projectCount.mockReset().mockResolvedValue(1)
  transactionCreate.mockReset().mockResolvedValue(row)
  transactionUpdate.mockReset().mockResolvedValue(row)
  transactionFindFirst.mockReset().mockResolvedValue({
    source: 'manual',
    clientId: null,
    projectId: null,
  })
})

describe('createTransaction — relation ownership', () => {
  it('writes the row when both relations check out', async () => {
    await createTransaction(OWNER, { ...input, clientId: 'c1', projectId: 'p1' })
    expect(transactionCreate).toHaveBeenCalled()
  })

  it("refuses a client that is not the owner's", async () => {
    clientCount.mockResolvedValue(0)

    await expect(
      createTransaction(OWNER, { ...input, clientId: 'someone-elses' }),
    ).rejects.toThrow('Client not found')
    expect(transactionCreate).not.toHaveBeenCalled()
  })

  it('refuses a project belonging to a different client', async () => {
    projectCount.mockResolvedValue(0)

    await expect(
      createTransaction(OWNER, { ...input, clientId: 'c1', projectId: 'p-of-c2' }),
    ).rejects.toThrow('Project not found for this client')
    expect(transactionCreate).not.toHaveBeenCalled()
  })

  it('requires the project to be the owner even with no client on the row', async () => {
    projectCount.mockResolvedValue(0)

    await expect(
      createTransaction(OWNER, { ...input, projectId: 'someone-elses' }),
    ).rejects.toThrow('Project not found')
    expect(transactionCreate).not.toHaveBeenCalled()
  })

  it('checks the project against the client it was given', async () => {
    await createTransaction(OWNER, { ...input, clientId: 'c1', projectId: 'p1' })

    expect(projectCount.mock.calls[0][0].where).toEqual({
      id: 'p1',
      ownerId: OWNER,
      clientId: 'c1',
    })
  })

  it('skips both checks when the row has no relations', async () => {
    await createTransaction(OWNER, input)

    expect(clientCount).not.toHaveBeenCalled()
    expect(projectCount).not.toHaveBeenCalled()
  })
})

describe('updateTransaction — relation ownership', () => {
  it('refuses to move a row onto a foreign client', async () => {
    clientCount.mockResolvedValue(0)

    await expect(
      updateTransaction(OWNER, 't1', { clientId: 'someone-elses' }),
    ).rejects.toThrow('Client not found')
    expect(transactionUpdate).not.toHaveBeenCalled()
  })

  it('validates a new project against the client already on the row', async () => {
    // The request only changes the project, so the check has to read the
    // stored client — otherwise switching one at a time slips past it.
    transactionFindFirst.mockResolvedValue({
      source: 'manual',
      clientId: 'c1',
      projectId: null,
    })

    await updateTransaction(OWNER, 't1', { projectId: 'p1' })

    expect(projectCount.mock.calls[0][0].where).toEqual({
      id: 'p1',
      ownerId: OWNER,
      clientId: 'c1',
    })
  })

  it('validates the stored project against a newly chosen client', async () => {
    transactionFindFirst.mockResolvedValue({
      source: 'manual',
      clientId: 'c1',
      projectId: 'p1',
    })
    projectCount.mockResolvedValue(0)

    await expect(
      updateTransaction(OWNER, 't1', { clientId: 'c2' }),
    ).rejects.toThrow('Project not found for this client')
  })

  it('leaves an unrelated edit alone', async () => {
    await updateTransaction(OWNER, 't1', { description: 'renamed' })

    expect(clientCount).not.toHaveBeenCalled()
    expect(projectCount).not.toHaveBeenCalled()
    expect(transactionUpdate).toHaveBeenCalled()
  })
})
