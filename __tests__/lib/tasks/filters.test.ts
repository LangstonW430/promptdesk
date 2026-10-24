import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The filters `listTasks` builds.
 *
 * `buildTaskWhere` is private, so these go through `listTasks` and read the
 * `where` it passed to Prisma — the same approach
 * `__tests__/lib/db/ownership.test.ts` takes.
 *
 * The first test is the important one. `clientId`, `status` and `limit` were
 * added for the MCP server, and `buildTaskWhere` is shared with `/api/tasks`,
 * `listTasksAction` and the dashboard. If adding them changed what an existing
 * caller gets, that is a silent behaviour change across three surfaces.
 */

const findMany = vi.fn()
const count = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    task: {
      get findMany() {
        return findMany
      },
      get count() {
        return count
      },
    },
  },
}))

const { listTasks, countTasks } = await import('@/lib/tasks')

const OWNER = 'owner-abc'

/** The `where` from the most recent findMany call. */
function lastWhere() {
  return findMany.mock.calls[0][0].where
}

/** The AND conditions, which is how buildTaskWhere composes. */
function conditions() {
  return lastWhere().AND
}

describe('listTasks filters', () => {
  beforeEach(() => {
    findMany.mockReset()
    findMany.mockResolvedValue([])
    count.mockReset()
    count.mockResolvedValue(0)
  })

  it('still asks only for the owner when given no filters', async () => {
    await listTasks(OWNER)

    expect(lastWhere()).toEqual({ AND: [{ ownerId: OWNER }] })
  })

  it('still applies no limit when none is given', async () => {
    await listTasks(OWNER)

    expect(findMany.mock.calls[0][0]).not.toHaveProperty('take')
  })

  it('scopes by owner even when filtering by something else', async () => {
    await listTasks(OWNER, { projectId: 'project-1' })

    expect(conditions()).toContainEqual({ ownerId: OWNER })
  })

  /**
   * A task carries no `clientId`, so this has to reach through the project.
   * The project's own `ownerId` is checked as well as the task's — see the
   * comment in lib/tasks/index.ts for why both.
   */
  it('filters by client through the project relation, owner-scoped', async () => {
    await listTasks(OWNER, { clientId: 'client-1' })

    expect(conditions()).toContainEqual({
      project: { clientId: 'client-1', ownerId: OWNER },
    })
  })

  it('translates status into a completion filter', async () => {
    await listTasks(OWNER, { status: 'open' })
    expect(conditions()).toContainEqual({ isDone: false })

    findMany.mockReset()
    findMany.mockResolvedValue([])
    await listTasks(OWNER, { status: 'done' })
    expect(conditions()).toContainEqual({ isDone: true })
  })

  it('adds no completion filter for status "all"', async () => {
    await listTasks(OWNER, { status: 'all' })

    expect(conditions()).toEqual([{ ownerId: OWNER }])
  })

  it('applies a limit when one is given', async () => {
    await listTasks(OWNER, { limit: 10 })

    expect(findMany.mock.calls[0][0].take).toBe(10)
  })

  /**
   * `due` has always implied "not done" and the REST route depends on it. The
   * MCP tool refuses the contradictory combination rather than relying on this.
   */
  it('keeps treating a due filter as being about outstanding work', async () => {
    await listTasks(OWNER, { due: 'overdue' })

    expect(conditions()).toContainEqual(
      expect.objectContaining({ isDone: false }),
    )
  })
})

describe('countTasks', () => {
  beforeEach(() => {
    count.mockReset()
    count.mockResolvedValue(3)
  })

  it('counts with the same filters, so truncation can be reported', async () => {
    await countTasks(OWNER, { clientId: 'client-1', status: 'open' })

    const where = count.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ ownerId: OWNER })
    expect(where.AND).toContainEqual({
      project: { clientId: 'client-1', ownerId: OWNER },
    })
    expect(where.AND).toContainEqual({ isDone: false })
  })

  it('ignores any limit, since it reports the untruncated total', async () => {
    await countTasks(OWNER, { limit: 5 })

    expect(count.mock.calls[0][0]).not.toHaveProperty('take')
  })
})
