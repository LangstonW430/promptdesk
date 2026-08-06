import { describe, it, expect, beforeEach, vi } from 'vitest'

const clientFindMany = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    client: {
      get findMany() {
        return clientFindMany
      },
    },
  },
}))

vi.mock('@/lib/relationship-summary/refresh', () => ({
  refreshClientSummary: vi.fn(),
}))

const { listClientsForTable, listClientOptions } = await import('@/lib/clients')

const OWNER = 'owner-abc-123'

// Columns the /clients table and kanban actually render. Anything outside this
// set is dead weight on a list that loads every client the owner has.
const TABLE_COLUMNS = [
  'id',
  'companyName',
  'contactName',
  'email',
  'industry',
  'status',
  'estimatedValue',
  'lastContactDate',
  'nextFollowupDate',
]

// Long free-text columns. These are the reason the list query is projected:
// they are unbounded in length and no list view displays them.
const HEAVY_COLUMNS = [
  'painPoints',
  'requirements',
  'opportunityNotes',
  'relationshipSummary',
  'customFields',
]

describe('listClientsForTable projection', () => {
  beforeEach(() => {
    clientFindMany.mockReset()
    clientFindMany.mockResolvedValue([])
  })

  it('projects columns explicitly instead of selecting whole rows', async () => {
    await listClientsForTable(OWNER)

    const arg = clientFindMany.mock.calls[0][0]
    expect(arg.select).toBeDefined()
    expect(arg.include).toBeUndefined()
  })

  it('selects every column the table renders', async () => {
    await listClientsForTable(OWNER)

    const select = clientFindMany.mock.calls[0][0].select
    for (const column of TABLE_COLUMNS) {
      expect(select[column]).toBe(true)
    }
  })

  it('does not pull the long intelligence free-text columns', async () => {
    await listClientsForTable(OWNER)

    const select = clientFindMany.mock.calls[0][0].select
    for (const column of HEAVY_COLUMNS) {
      expect(select[column]).toBeUndefined()
    }
  })

  it('narrows the tag join to the two fields the UI reads', async () => {
    await listClientsForTable(OWNER)

    const select = clientFindMany.mock.calls[0][0].select
    expect(select.clientTags.select.tag.select).toEqual({ id: true, label: true })
  })

  it('still applies the owner scope and filters', async () => {
    await listClientsForTable(OWNER, { status: 'won' })

    const where = clientFindMany.mock.calls[0][0].where
    expect(where.AND).toEqual(
      expect.arrayContaining([{ ownerId: OWNER }, { status: 'won' }]),
    )
  })
})

describe('listClientOptions', () => {
  beforeEach(() => {
    clientFindMany.mockReset()
    clientFindMany.mockResolvedValue([])
  })

  it('scopes to the owner and excludes archived clients', async () => {
    await listClientOptions(OWNER)

    expect(clientFindMany.mock.calls[0][0].where).toEqual({
      ownerId: OWNER,
      isArchived: false,
    })
  })

  it('selects only the columns needed to label an option', async () => {
    await listClientOptions(OWNER)

    expect(clientFindMany.mock.calls[0][0].select).toEqual({
      id: true,
      companyName: true,
      contactName: true,
    })
  })

  it('falls back from company name to contact name to Unknown', async () => {
    clientFindMany.mockResolvedValue([
      { id: '1', companyName: 'Acme', contactName: 'Ada' },
      { id: '2', companyName: null, contactName: 'Grace' },
      { id: '3', companyName: null, contactName: null },
    ])

    await expect(listClientOptions(OWNER)).resolves.toEqual([
      { id: '1', name: 'Acme' },
      { id: '2', name: 'Grace' },
      { id: '3', name: 'Unknown' },
    ])
  })
})
