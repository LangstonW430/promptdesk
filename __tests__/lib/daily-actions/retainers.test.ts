import { describe, it, expect, beforeEach, vi } from 'vitest'

const findMany = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    transaction: {
      get findMany() {
        return findMany
      },
    },
  },
}))

const { getRetainerReminders } = await import('@/lib/daily-actions')

const OWNER = 'owner-abc-123'

describe('getRetainerReminders', () => {
  beforeEach(() => {
    findMany.mockReset()
    findMany.mockResolvedValue([])
  })

  it('excludes transactions belonging to an archived client', async () => {
    await getRetainerReminders(OWNER)

    const where = findMany.mock.calls[0][0].where
    expect(where.OR).toEqual(
      expect.arrayContaining([{ client: { isArchived: false } }]),
    )
  })

  it('keeps transactions that have no client at all', async () => {
    await getRetainerReminders(OWNER)

    // clientId is nullable — a transaction with no client is not tied to an
    // archived one and must still surface.
    const where = findMany.mock.calls[0][0].where
    expect(where.OR).toEqual(expect.arrayContaining([{ clientId: null }]))
  })

  it('still scopes to the owner and to recurring income', async () => {
    await getRetainerReminders(OWNER)

    const where = findMany.mock.calls[0][0].where
    expect(where.ownerId).toBe(OWNER)
    expect(where.type).toBe('income')
    expect(where.isRecurring).toBe(true)
  })
})
