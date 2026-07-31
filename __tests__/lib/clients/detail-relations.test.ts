import { describe, it, expect, beforeEach, vi } from 'vitest'

const clientFindFirst = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    client: {
      get findFirst() {
        return clientFindFirst
      },
    },
  },
}))

vi.mock('@/lib/relationship-summary/refresh', () => ({
  refreshClientSummary: vi.fn(),
}))

const { getClientById } = await import('@/lib/clients')

const OWNER = 'owner-abc-123'
const CLIENT = 'client-def-456'

describe('getClientById relation loading', () => {
  beforeEach(() => {
    clientFindFirst.mockReset()
    clientFindFirst.mockResolvedValue(null)
  })

  it('scopes to the owner', async () => {
    await getClientById(OWNER, CLIENT)

    expect(clientFindFirst.mock.calls[0][0].where).toEqual({
      id: CLIENT,
      ownerId: OWNER,
    })
  })

  it('excludes archived projects from the client detail page', async () => {
    // Regression guard: this filter was silently dropped once by a merge that
    // resolved in favour of a branch which had only added `take` here.
    await getClientById(OWNER, CLIENT)

    const projects = clientFindFirst.mock.calls[0][0].include.projects
    expect(projects.where.isArchived).toBe(false)
  })

  it('still excludes cancelled projects', async () => {
    await getClientById(OWNER, CLIENT)

    const projects = clientFindFirst.mock.calls[0][0].include.projects
    expect(projects.where.status).toEqual({ not: 'cancelled' })
  })

  it('keeps child collections bounded', async () => {
    await getClientById(OWNER, CLIENT)

    const include = clientFindFirst.mock.calls[0][0].include
    for (const relation of ['notes', 'attachments', 'activities', 'projects']) {
      expect(include[relation].take).toBeGreaterThan(0)
    }
  })
})
