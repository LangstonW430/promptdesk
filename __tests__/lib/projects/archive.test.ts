import { describe, it, expect, beforeEach, vi } from 'vitest'

const projectFindMany = vi.fn()
const projectCount = vi.fn()
const projectUpdate = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    project: {
      get findMany() {
        return projectFindMany
      },
      get count() {
        return projectCount
      },
      get update() {
        return projectUpdate
      },
    },
  },
}))

const { listProjects, setProjectArchived, isProjectActionable } = await import(
  '@/lib/projects'
)

const OWNER = 'owner-abc-123'
const PROJECT = 'project-def-456'

describe('listProjects', () => {
  beforeEach(() => {
    projectFindMany.mockReset()
    projectFindMany.mockResolvedValue([])
  })

  it('hides archived projects by default', async () => {
    await listProjects(OWNER)

    const where = projectFindMany.mock.calls[0][0].where
    expect(where.ownerId).toBe(OWNER)
    expect(where.isArchived).toBe(false)
  })

  it('returns only archived projects when asked', async () => {
    await listProjects(OWNER, { archived: true })

    expect(projectFindMany.mock.calls[0][0].where.isArchived).toBe(true)
  })

  it('keeps the archived filter alongside other filters', async () => {
    await listProjects(OWNER, { status: 'active', clientId: 'client-1' })

    const where = projectFindMany.mock.calls[0][0].where
    expect(where.isArchived).toBe(false)
    expect(where.status).toBe('active')
    expect(where.clientId).toBe('client-1')
  })
})

describe('setProjectArchived', () => {
  beforeEach(() => {
    projectCount.mockReset()
    projectUpdate.mockReset()
    projectUpdate.mockResolvedValue({ id: PROJECT, isArchived: true })
  })

  it('scopes the ownership check to the owner', async () => {
    projectCount.mockResolvedValue(1)
    await setProjectArchived(OWNER, PROJECT, true)

    expect(projectCount.mock.calls[0][0].where).toEqual({
      id: PROJECT,
      ownerId: OWNER,
    })
  })

  it('returns null and does not write for another owner\'s project', async () => {
    projectCount.mockResolvedValue(0)

    const result = await setProjectArchived(OWNER, PROJECT, true)

    expect(result).toBeNull()
    expect(projectUpdate).not.toHaveBeenCalled()
  })

  it('unarchives when passed false', async () => {
    projectCount.mockResolvedValue(1)
    await setProjectArchived(OWNER, PROJECT, false)

    expect(projectUpdate.mock.calls[0][0].data).toEqual({ isArchived: false })
  })
})

describe('isProjectActionable', () => {
  beforeEach(() => {
    projectCount.mockReset()
  })

  it('requires the project to be unarchived and owned', async () => {
    projectCount.mockResolvedValue(1)

    await isProjectActionable(OWNER, PROJECT)

    expect(projectCount.mock.calls[0][0].where).toEqual({
      id: PROJECT,
      ownerId: OWNER,
      isArchived: false,
    })
  })

  it('is false when nothing matches', async () => {
    projectCount.mockResolvedValue(0)
    expect(await isProjectActionable(OWNER, PROJECT)).toBe(false)
  })
})
