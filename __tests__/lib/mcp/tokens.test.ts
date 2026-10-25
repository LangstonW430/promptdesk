import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hashToken } from '@/lib/mcp/token'

/**
 * Reading and writing token rows.
 *
 * The test that matters most is "never stores the plaintext": only the hash is
 * meant to reach the database, and the failure mode — writing the token itself
 * into a column — would be invisible in every other test, because
 * authentication would still work perfectly.
 */

const create = vi.fn()
const findMany = vi.fn()
const findFirst = vi.fn()
const updateMany = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    mcpToken: {
      get create() {
        return create
      },
      get findMany() {
        return findMany
      },
      get findFirst() {
        return findFirst
      },
      get updateMany() {
        return updateMany
      },
    },
  },
}))

const { createMcpToken, listMcpTokens, revokeMcpToken } = await import(
  '@/lib/mcp/tokens'
)

const OWNER = 'owner-abc'
const OTHER = 'owner-xyz'

const ROW = {
  id: 'token-1',
  name: 'Laptop',
  tokenHint: 'pd_live_abc123',
  lastUsedAt: null,
  createdAt: new Date('2026-06-03T12:00:00Z'),
  revokedAt: null,
}

describe('createMcpToken', () => {
  beforeEach(() => {
    create.mockReset()
    create.mockResolvedValue(ROW)
  })

  it('stores the hash of the token, not the token', async () => {
    const { plaintext } = await createMcpToken(OWNER, { name: 'Laptop' })
    const data = create.mock.calls[0][0].data

    expect(data.tokenHash).toBe(hashToken(plaintext))

    // Nothing written anywhere in the row may contain the token itself.
    for (const value of Object.values(data)) {
      if (typeof value !== 'string') continue
      expect(value).not.toBe(plaintext)
      expect(plaintext.includes(value) && value.length > 20).toBe(false)
    }
  })

  it('writes the owner from its argument', async () => {
    await createMcpToken(OWNER, { name: 'Laptop' })

    expect(create.mock.calls[0][0].data.ownerId).toBe(OWNER)
  })

  it('never selects the hash back out', async () => {
    await createMcpToken(OWNER, { name: 'Laptop' })

    expect(create.mock.calls[0][0].select).not.toHaveProperty('tokenHash')
  })

  it('returns the plaintext, since it can never be recovered later', async () => {
    const { plaintext } = await createMcpToken(OWNER, { name: 'Laptop' })

    expect(plaintext).toMatch(/^pd_live_/)
  })
})

describe('listMcpTokens', () => {
  beforeEach(() => {
    findMany.mockReset()
    findMany.mockResolvedValue([ROW])
  })

  it('scopes the query to the owner', async () => {
    await listMcpTokens(OWNER)

    expect(findMany.mock.calls[0][0].where).toEqual({ ownerId: OWNER })
  })

  /**
   * The hash would otherwise travel into a server component's props and from
   * there into the HTML payload sent to the browser.
   */
  it('does not select the hash', async () => {
    await listMcpTokens(OWNER)

    expect(findMany.mock.calls[0][0].select).not.toHaveProperty('tokenHash')
  })

  it('serialises dates as ISO strings', async () => {
    const [token] = await listMcpTokens(OWNER)

    expect(token.createdAt).toBe('2026-06-03T12:00:00.000Z')
    expect(token.lastUsedAt).toBeNull()
  })
})

describe('revokeMcpToken', () => {
  beforeEach(() => {
    updateMany.mockReset()
    updateMany.mockResolvedValue({ count: 1 })
    findFirst.mockReset()
    findFirst.mockResolvedValue({ ...ROW, revokedAt: new Date('2026-06-04T09:00:00Z') })
  })

  it('scopes the update by both id and owner', async () => {
    await revokeMcpToken(OWNER, 'token-1')

    expect(updateMany.mock.calls[0][0].where).toEqual({
      id: 'token-1',
      ownerId: OWNER,
      revokedAt: null,
    })
  })

  it('scopes the read-back by owner too', async () => {
    await revokeMcpToken(OWNER, 'token-1')

    expect(findFirst.mock.calls[0][0].where).toEqual({
      id: 'token-1',
      ownerId: OWNER,
    })
  })

  it("reports null for another account's token", async () => {
    findFirst.mockResolvedValue(null)

    expect(await revokeMcpToken(OTHER, 'token-1')).toBeNull()
  })

  /**
   * Revoking twice is not an error. The timestamp records the first
   * revocation — the `revokedAt: null` in the update filter is what protects
   * it — and the second call reports the row as it stands.
   */
  it('treats a second revocation as a success', async () => {
    updateMany.mockResolvedValue({ count: 0 })

    const token = await revokeMcpToken(OWNER, 'token-1')

    expect(token?.revokedAt).toBe('2026-06-04T09:00:00.000Z')
  })
})
