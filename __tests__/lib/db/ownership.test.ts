import { describe, it, expect, beforeEach, vi } from 'vitest'

const clientCount = vi.fn()
const projectCount = vi.fn()

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
  },
}))

const { ownsClient, ownsProject } = await import('@/lib/db/ownership')

const OWNER = 'owner-abc'
const OTHER = 'owner-xyz'

describe('ownsClient', () => {
  beforeEach(() => {
    clientCount.mockReset()
    clientCount.mockResolvedValue(0)
  })

  it('scopes the lookup by both id and owner', async () => {
    await ownsClient(OWNER, 'client-1')

    expect(clientCount.mock.calls[0][0].where).toEqual({
      id: 'client-1',
      ownerId: OWNER,
    })
  })

  it('is false when the client belongs to somebody else', async () => {
    // The count comes back 0 precisely because the owner is in the WHERE.
    clientCount.mockResolvedValue(0)
    expect(await ownsClient(OTHER, 'client-1')).toBe(false)
  })

  it('is true when it belongs to the owner', async () => {
    clientCount.mockResolvedValue(1)
    expect(await ownsClient(OWNER, 'client-1')).toBe(true)
  })
})

describe('ownsProject', () => {
  beforeEach(() => {
    projectCount.mockReset()
    projectCount.mockResolvedValue(1)
  })

  it('scopes by owner when no client is given', async () => {
    await ownsProject(OWNER, 'project-1')

    expect(projectCount.mock.calls[0][0].where).toEqual({
      id: 'project-1',
      ownerId: OWNER,
    })
  })

  it('also requires the project to belong to the given client', async () => {
    // Attaching one client's money to another client's project is not a
    // permission failure, but it puts the wrong number in a project's P&L.
    await ownsProject(OWNER, 'project-1', 'client-1')

    expect(projectCount.mock.calls[0][0].where).toEqual({
      id: 'project-1',
      ownerId: OWNER,
      clientId: 'client-1',
    })
  })

  it('does not add a client filter for an empty client id', async () => {
    await ownsProject(OWNER, 'project-1', '')

    expect(projectCount.mock.calls[0][0].where).toEqual({
      id: 'project-1',
      ownerId: OWNER,
    })
  })

  it('is false when nothing matches', async () => {
    projectCount.mockResolvedValue(0)
    expect(await ownsProject(OWNER, 'project-1', 'client-1')).toBe(false)
  })
})
