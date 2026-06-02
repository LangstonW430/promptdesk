import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildClientWhere } from '@/lib/clients/filters'

const OWNER = 'owner-abc-123'

describe('buildClientWhere', () => {
  it('always includes ownerId and isArchived:false by default', () => {
    const where = buildClientWhere(OWNER)
    expect(where.AND).toEqual(
      expect.arrayContaining([{ ownerId: OWNER }, { isArchived: false }]),
    )
  })

  it('respects archived:true', () => {
    const where = buildClientWhere(OWNER, { archived: true })
    expect(where.AND).toEqual(
      expect.arrayContaining([{ isArchived: true }]),
    )
    expect(where.AND).not.toEqual(
      expect.arrayContaining([{ isArchived: false }]),
    )
  })

  describe('status filter', () => {
    it('adds status condition when provided', () => {
      const where = buildClientWhere(OWNER, { status: 'lead' })
      expect(where.AND).toEqual(expect.arrayContaining([{ status: 'lead' }]))
    })

    it('does not add status condition when omitted', () => {
      const where = buildClientWhere(OWNER, {})
      const conditions = where.AND as unknown[]
      const hasStatus = conditions.some(
        (c) =>
          typeof c === 'object' && c !== null && 'status' in (c as object),
      )
      expect(hasStatus).toBe(false)
    })
  })

  describe('search query filter', () => {
    it('adds OR conditions matching companyName, contactName, and email', () => {
      const where = buildClientWhere(OWNER, { q: 'acme' })
      const conditions = where.AND as Array<{ OR?: unknown[] }>
      const orBlock = conditions.find((c) => Array.isArray(c.OR))
      expect(orBlock).toBeDefined()
      expect(orBlock!.OR).toEqual(
        expect.arrayContaining([
          { companyName: { contains: 'acme', mode: 'insensitive' } },
          { contactName: { contains: 'acme', mode: 'insensitive' } },
          { email: { contains: 'acme', mode: 'insensitive' } },
        ]),
      )
    })

    it('does not add OR conditions when q is omitted', () => {
      const where = buildClientWhere(OWNER, {})
      const conditions = where.AND as Array<{ OR?: unknown[] }>
      const orBlock = conditions.find((c) => Array.isArray(c.OR))
      expect(orBlock).toBeUndefined()
    })
  })

  describe('tag filter', () => {
    it('adds clientTags.some condition scoped to ownerId', () => {
      const where = buildClientWhere(OWNER, { tag: 'VIP' })
      expect(where.AND).toEqual(
        expect.arrayContaining([
          {
            clientTags: {
              some: {
                tag: {
                  label: { equals: 'VIP', mode: 'insensitive' },
                  ownerId: OWNER,
                },
              },
            },
          },
        ]),
      )
    })

    it('does not add tag condition when omitted', () => {
      const where = buildClientWhere(OWNER, {})
      const conditions = where.AND as Array<{ clientTags?: unknown }>
      const hasTag = conditions.some((c) => 'clientTags' in c)
      expect(hasTag).toBe(false)
    })
  })

  describe('stale filter', () => {
    const FIXED_NOW = new Date('2026-06-02T12:00:00.000Z')

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(FIXED_NOW)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('excludes won and lost statuses', () => {
      const where = buildClientWhere(OWNER, { stale: 30 })
      expect(where.AND).toEqual(
        expect.arrayContaining([{ status: { notIn: ['won', 'lost'] } }]),
      )
    })

    it('filters on lastContactDate less than threshold', () => {
      const where = buildClientWhere(OWNER, { stale: 30 })
      const threshold = new Date('2026-06-02T12:00:00.000Z')
      threshold.setDate(threshold.getDate() - 30)

      const conditions = where.AND as Array<{ OR?: unknown[] }>
      const orBlock = conditions.find((c) => Array.isArray(c.OR))
      expect(orBlock).toBeDefined()
      expect(orBlock!.OR).toEqual(
        expect.arrayContaining([{ lastContactDate: { lt: threshold } }]),
      )
    })

    it('also matches clients never contacted (null) created before threshold', () => {
      const where = buildClientWhere(OWNER, { stale: 30 })
      const threshold = new Date('2026-06-02T12:00:00.000Z')
      threshold.setDate(threshold.getDate() - 30)

      const conditions = where.AND as Array<{ OR?: unknown[] }>
      const orBlock = conditions.find((c) => Array.isArray(c.OR))
      expect(orBlock!.OR).toEqual(
        expect.arrayContaining([
          {
            AND: expect.arrayContaining([
              { lastContactDate: { equals: null } },
              { createdAt: { lt: threshold } },
            ]),
          },
        ]),
      )
    })

    it('does not add stale conditions when stale is 0', () => {
      const where = buildClientWhere(OWNER, { stale: 0 })
      const conditions = where.AND as Array<{ status?: unknown }>
      const hasNotIn = conditions.some(
        (c) =>
          typeof c === 'object' &&
          c !== null &&
          'status' in c &&
          typeof (c as { status: { notIn?: unknown } }).status === 'object',
      )
      expect(hasNotIn).toBe(false)
    })
  })

  describe('combined filters', () => {
    it('applies multiple filters simultaneously', () => {
      const where = buildClientWhere(OWNER, {
        status: 'contacted',
        q: 'smith',
        tag: 'hot',
      })
      const conditions = where.AND as unknown[]
      expect(conditions.length).toBeGreaterThanOrEqual(5) // ownerId + isArchived + status + OR(q) + clientTags
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { ownerId: OWNER },
          { isArchived: false },
          { status: 'contacted' },
        ]),
      )
    })
  })
})
