import { describe, it, expect, beforeEach, vi } from 'vitest'

const projectGroupBy = vi.fn()
const projectAggregate = vi.fn()
const queryRaw = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    project: {
      get groupBy() {
        return projectGroupBy
      },
      get aggregate() {
        return projectAggregate
      },
    },
    get $queryRaw() {
      return queryRaw
    },
  },
}))

const {
  PIPELINE_PROJECT_STATUSES,
  pipelineValueByClient,
  pipelineValueForClient,
  pipelineValueByClientStatus,
} = await import('@/lib/clients/pipeline-value')

const OWNER = 'owner-abc-123'

describe('PIPELINE_PROJECT_STATUSES', () => {
  it('counts proposed and active work only', () => {
    // Completed work is already billed; on_hold and cancelled are not expected
    // to land. Including any of them would overstate every pipeline figure.
    expect([...PIPELINE_PROJECT_STATUSES]).toEqual(['proposed', 'active'])
  })
})

describe('pipelineValueByClient', () => {
  beforeEach(() => {
    projectGroupBy.mockReset()
    projectGroupBy.mockResolvedValue([])
  })

  it('scopes to the owner, open statuses, and unarchived projects', async () => {
    await pipelineValueByClient(OWNER)

    const where = projectGroupBy.mock.calls[0][0].where
    expect(where.ownerId).toBe(OWNER)
    expect(where.isArchived).toBe(false)
    expect(where.status).toEqual({ in: ['proposed', 'active'] })
  })

  it('sums budgets per client', async () => {
    projectGroupBy.mockResolvedValue([
      { clientId: 'c1', _sum: { budget: 12_000 } },
      { clientId: 'c2', _sum: { budget: 400 } },
    ])

    const map = await pipelineValueByClient(OWNER)
    expect(map.get('c1')).toBe(12_000)
    expect(map.get('c2')).toBe(400)
  })

  it('omits clients with no open projects rather than reporting zero', async () => {
    // The Hot Leads queue keys off presence: a lead nobody has quoted should
    // not surface, which a 0 entry would not distinguish from a $0 quote.
    projectGroupBy.mockResolvedValue([{ clientId: 'c1', _sum: { budget: 100 } }])

    const map = await pipelineValueByClient(OWNER)
    expect(map.has('c2')).toBe(false)
  })

  it('narrows to the given clients when asked', async () => {
    await pipelineValueByClient(OWNER, ['c1', 'c2'])

    expect(projectGroupBy.mock.calls[0][0].where.clientId).toEqual({
      in: ['c1', 'c2'],
    })
  })

  it('short-circuits on an empty id list instead of querying every client', async () => {
    const map = await pipelineValueByClient(OWNER, [])

    expect(projectGroupBy).not.toHaveBeenCalled()
    expect(map.size).toBe(0)
  })

  it('treats a null sum as zero', async () => {
    projectGroupBy.mockResolvedValue([{ clientId: 'c1', _sum: { budget: null } }])

    const map = await pipelineValueByClient(OWNER)
    expect(map.get('c1')).toBe(0)
  })
})

describe('pipelineValueForClient', () => {
  beforeEach(() => {
    projectAggregate.mockReset()
    projectAggregate.mockResolvedValue({ _sum: { budget: null } })
  })

  it('returns 0 when the client has no open projects', async () => {
    await expect(pipelineValueForClient(OWNER, 'c1')).resolves.toBe(0)
  })

  it('scopes to the owner and that one client', async () => {
    await pipelineValueForClient(OWNER, 'c1')

    const where = projectAggregate.mock.calls[0][0].where
    expect(where.ownerId).toBe(OWNER)
    expect(where.clientId).toBe('c1')
    expect(where.status).toEqual({ in: ['proposed', 'active'] })
  })
})

describe('pipelineValueByClientStatus', () => {
  beforeEach(() => {
    queryRaw.mockReset()
    queryRaw.mockResolvedValue([])
  })

  it('keys the totals by client status', async () => {
    queryRaw.mockResolvedValue([
      { status: 'lead', total: 5_000 },
      { status: 'negotiating', total: 22_000 },
    ])

    const map = await pipelineValueByClientStatus(OWNER)
    expect(map.get('lead')).toBe(5_000)
    expect(map.get('negotiating')).toBe(22_000)
  })

  it('treats a null total as zero', async () => {
    queryRaw.mockResolvedValue([{ status: 'lead', total: null }])

    const map = await pipelineValueByClientStatus(OWNER)
    expect(map.get('lead')).toBe(0)
  })
})
