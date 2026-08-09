import { describe, it, expect, beforeEach, vi } from 'vitest'

const clientFindMany = vi.fn()
const projectGroupBy = vi.fn()
const queryRaw = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    client: {
      get findMany() {
        return clientFindMany
      },
    },
    project: {
      get groupBy() {
        return projectGroupBy
      },
    },
    get $queryRaw() {
      return queryRaw
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
  'lastContactDate',
  'nextFollowupDate',
]

// The stage is not among them: it is derived from projects and notes, so there
// is no column to select — see lib/clients/stage.ts.

// Long free-text columns. These are the reason the list query is projected:
// they are unbounded in length and no list view displays them.
const HEAVY_COLUMNS = [
  'painPoints',
  'requirements',
  'opportunityNotes',
  'relationshipSummary',
  'customFields',
  // Superseded by the derived pipeline value — selecting it again would
  // reintroduce the per-client estimate this table stopped rendering.
  'estimatedValue',
]

describe('listClientsForTable projection', () => {
  beforeEach(() => {
    clientFindMany.mockReset()
    projectGroupBy.mockReset()
    clientFindMany.mockResolvedValue([])
    projectGroupBy.mockResolvedValue([])
    queryRaw.mockReset()
    queryRaw.mockResolvedValue([])
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
    await listClientsForTable(OWNER, { q: 'acme' })

    const where = clientFindMany.mock.calls[0][0].where
    expect(where.AND).toEqual(expect.arrayContaining([{ ownerId: OWNER }]))
  })

  it('filters by stage after deriving it, never in the query', async () => {
    clientFindMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])
    queryRaw.mockResolvedValue([
      { id: 'c1', is_archived: false, has_active: true, has_proposed: false, has_completed: false, contacted: true },
      { id: 'c2', is_archived: false, has_active: false, has_proposed: false, has_completed: false, contacted: false },
    ])

    const rows = await listClientsForTable(OWNER, { stage: 'active' })

    const where = clientFindMany.mock.calls[0][0].where
    const conditions = where.AND as unknown[]
    expect(
      conditions.some((c) => typeof c === 'object' && c !== null && 'stage' in (c as object)),
    ).toBe(false)

    expect(rows.map((r) => r.id)).toEqual(['c1'])
  })

  it('attaches pipeline value summed from each client\'s open projects', async () => {
    clientFindMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])
    projectGroupBy.mockResolvedValue([{ clientId: 'c1', _sum: { budget: 9000 } }])

    const rows = await listClientsForTable(OWNER)

    // c2 has no open projects, so it reports null rather than 0 — "nobody has
    // quoted them" is not the same claim as "they are worth nothing".
    expect(rows).toEqual([
      { id: 'c1', pipelineValue: 9000, stage: 'lead' },
      { id: 'c2', pipelineValue: null, stage: 'lead' },
    ])
  })

  it('scopes the value aggregate to the owner and to open project statuses', async () => {
    clientFindMany.mockResolvedValue([{ id: 'c1' }])
    await listClientsForTable(OWNER)

    const where = projectGroupBy.mock.calls[0][0].where
    expect(where.ownerId).toBe(OWNER)
    expect(where.isArchived).toBe(false)
    expect(where.status).toEqual({ in: ['proposed', 'active'] })
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
