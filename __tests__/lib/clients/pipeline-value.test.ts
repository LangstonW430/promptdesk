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
  pipelineValueByStage,
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

describe('pipelineValueByStage', () => {
  beforeEach(() => {
    queryRaw.mockReset()
    queryRaw.mockResolvedValue([])
    projectGroupBy.mockReset()
    projectGroupBy.mockResolvedValue([])
  })

  const stageRow = (
    id: string,
    over: Partial<{
      is_archived: boolean
      has_active: boolean
      has_proposed: boolean
      has_completed: boolean
      contacted: boolean
    }> = {},
  ) => ({
    id,
    is_archived: false,
    has_active: false,
    has_proposed: false,
    has_completed: false,
    contacted: false,
    ...over,
  })

  it('keys the totals by the derived stage, not by a stored column', async () => {
    projectGroupBy.mockResolvedValue([
      { clientId: 'c1', _sum: { budget: 5_000 } },
      { clientId: 'c2', _sum: { budget: 22_000 } },
    ])
    queryRaw.mockResolvedValue([
      stageRow('c1'),
      stageRow('c2', { has_proposed: true, contacted: true }),
    ])

    const map = await pipelineValueByStage(OWNER)
    expect(map.get('lead')).toBe(5_000)
    expect(map.get('proposal_out')).toBe(22_000)
  })

  it('adds up clients that land on the same stage', async () => {
    projectGroupBy.mockResolvedValue([
      { clientId: 'c1', _sum: { budget: 5_000 } },
      { clientId: 'c2', _sum: { budget: 1_500 } },
    ])
    queryRaw.mockResolvedValue([
      stageRow('c1', { has_proposed: true }),
      stageRow('c2', { has_proposed: true }),
    ])

    const map = await pipelineValueByStage(OWNER)
    expect(map.get('proposal_out')).toBe(6_500)
  })

  it('reports nothing for a client whose stage could not be derived', async () => {
    projectGroupBy.mockResolvedValue([{ clientId: 'ghost', _sum: { budget: 900 } }])
    queryRaw.mockResolvedValue([])

    const map = await pipelineValueByStage(OWNER)
    expect(map.size).toBe(0)
  })
})
