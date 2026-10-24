import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateToken, hashToken } from '@/lib/mcp/token'

/**
 * The one function that decides whose data an MCP request may see.
 *
 * Two classes of failure are covered. The first is accepting a credential it
 * should not: an unknown token, a revoked one, or — the one this seam exists to
 * prevent — a token taken from somewhere other than the Authorization header.
 * The second is leaking which of those happened, since telling an
 * unauthenticated caller "that token was revoked" confirms it existed.
 */

const findUnique = vi.fn()
const update = vi.fn()
const afterCallbacks: Array<() => unknown> = []

vi.mock('next/server', () => ({
  // Captured rather than executed, so a test can assert the write was
  // scheduled without the scheduling itself being what is under test.
  after: (cb: () => unknown) => {
    afterCallbacks.push(cb)
  },
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    mcpToken: {
      get findUnique() {
        return findUnique
      },
      get update() {
        return update
      },
    },
  },
}))

const { resolveMcpOwner } = await import('@/lib/mcp/auth')
const { resetRateLimits } = await import('@/lib/rate-limit')

const OWNER = 'owner-abc'

function requestWith(headers: Record<string, string>, url = 'https://x.test/api/mcp') {
  return new Request(url, { method: 'POST', headers })
}

describe('resolveMcpOwner', () => {
  let token: string

  beforeEach(() => {
    resetRateLimits()
    afterCallbacks.length = 0
    token = generateToken().plaintext
    findUnique.mockReset()
    findUnique.mockResolvedValue({
      id: 'token-1',
      ownerId: OWNER,
      revokedAt: null,
      lastUsedAt: null,
    })
    update.mockReset()
    update.mockResolvedValue({})
  })

  it('resolves a known token to its owner', async () => {
    const result = await resolveMcpOwner(requestWith({ authorization: `Bearer ${token}` }))

    expect(result).toEqual({ ok: true, ownerId: OWNER })
  })

  it('looks the token up by its hash, never by its plaintext', async () => {
    await resolveMcpOwner(requestWith({ authorization: `Bearer ${token}` }))

    expect(findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashToken(token) })
  })

  it('rejects a missing header', async () => {
    const result = await resolveMcpOwner(requestWith({}))

    expect(result).toMatchObject({ ok: false, status: 401 })
  })

  it('rejects a revoked token', async () => {
    findUnique.mockResolvedValue({
      id: 'token-1',
      ownerId: OWNER,
      revokedAt: new Date(),
      lastUsedAt: null,
    })

    const result = await resolveMcpOwner(requestWith({ authorization: `Bearer ${token}` }))

    expect(result).toMatchObject({ ok: false, status: 401 })
  })

  it('rejects an unknown token', async () => {
    findUnique.mockResolvedValue(null)

    const result = await resolveMcpOwner(requestWith({ authorization: `Bearer ${token}` }))

    expect(result).toMatchObject({ ok: false, status: 401 })
  })

  /**
   * A revoked token and one that never existed produce the same message. The
   * difference would tell a caller which hashes are real.
   */
  it('says the same thing for revoked and unknown', async () => {
    findUnique.mockResolvedValue({
      id: 'token-1',
      ownerId: OWNER,
      revokedAt: new Date(),
      lastUsedAt: null,
    })
    const revoked = await resolveMcpOwner(requestWith({ authorization: `Bearer ${token}` }))

    resetRateLimits()
    findUnique.mockResolvedValue(null)
    const unknown = await resolveMcpOwner(requestWith({ authorization: `Bearer ${token}` }))

    expect(revoked).toEqual(unknown)
  })

  /**
   * The format check is in front of the hash for cost reasons, and this is
   * what proves it actually runs first: a malformed token must not reach the
   * database at all.
   */
  it('rejects a malformed token without querying', async () => {
    const result = await resolveMcpOwner(requestWith({ authorization: 'Bearer not-a-token' }))

    expect(result).toMatchObject({ ok: false, status: 401 })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('rejects an oversized header without querying', async () => {
    const result = await resolveMcpOwner(
      requestWith({ authorization: 'Bearer ' + 'a'.repeat(10_000) }),
    )

    expect(result).toMatchObject({ ok: false, status: 401 })
    expect(findUnique).not.toHaveBeenCalled()
  })

  /**
   * The header is the only place a credential is read from. A token in the
   * query string would end up in access logs and browser history, and one in
   * the body would be reachable by a cross-site form post.
   */
  it('ignores a token supplied in the query string', async () => {
    const result = await resolveMcpOwner(
      requestWith({}, `https://x.test/api/mcp?token=${token}`),
    )

    expect(result).toMatchObject({ ok: false, status: 401 })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('ignores a session cookie — it is not an MCP credential', async () => {
    const result = await resolveMcpOwner(requestWith({ cookie: 'sb-access-token=abc' }))

    expect(result).toMatchObject({ ok: false, status: 401 })
    expect(findUnique).not.toHaveBeenCalled()
  })

  describe('rate limiting', () => {
    it('refuses past the per-token ceiling, with a retry hint', async () => {
      let last
      for (let i = 0; i < 70; i++) {
        last = await resolveMcpOwner(requestWith({ authorization: `Bearer ${token}` }))
      }

      expect(last).toMatchObject({ ok: false, status: 429 })
      expect((last as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0)
    })

    /**
     * Keyed on the token, not the account, so one runaway client cannot spend
     * another's allowance.
     */
    it('keeps two tokens on separate budgets', async () => {
      const other = generateToken().plaintext
      for (let i = 0; i < 70; i++) {
        await resolveMcpOwner(requestWith({ authorization: `Bearer ${token}` }))
      }

      const result = await resolveMcpOwner(requestWith({ authorization: `Bearer ${other}` }))

      expect(result).toEqual({ ok: true, ownerId: OWNER })
    })
  })

  describe('lastUsedAt', () => {
    /**
     * Scheduled with `after()` rather than left floating: on a serverless
     * platform the instance can be frozen as soon as the response is sent, and
     * an un-awaited promise may simply never run.
     */
    it('schedules the write after the response', async () => {
      await resolveMcpOwner(requestWith({ authorization: `Bearer ${token}` }))

      expect(afterCallbacks).toHaveLength(1)
      expect(update).not.toHaveBeenCalled()

      await afterCallbacks[0]()

      expect(update.mock.calls[0][0].where).toEqual({ id: 'token-1' })
      expect(update.mock.calls[0][0].data.lastUsedAt).toBeInstanceOf(Date)
    })

    it('does not rewrite a timestamp that is already recent', async () => {
      findUnique.mockResolvedValue({
        id: 'token-1',
        ownerId: OWNER,
        revokedAt: null,
        lastUsedAt: new Date(),
      })

      await resolveMcpOwner(requestWith({ authorization: `Bearer ${token}` }))

      expect(afterCallbacks).toHaveLength(0)
    })

    it('still answers the request when the write fails', async () => {
      update.mockRejectedValue(new Error('connection lost'))

      const result = await resolveMcpOwner(requestWith({ authorization: `Bearer ${token}` }))
      await expect(afterCallbacks[0]()).resolves.not.toThrow()

      expect(result).toEqual({ ok: true, ownerId: OWNER })
    })
  })
})
