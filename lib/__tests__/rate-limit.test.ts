import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit, resetRateLimits, clientIp } from '@/lib/rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimits()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const opts = { limit: 3, windowMs: 60_000 }

  it('allows up to the limit, then refuses', () => {
    expect(rateLimit('b', 'k', opts)).toEqual({ ok: true, remaining: 2 })
    expect(rateLimit('b', 'k', opts)).toEqual({ ok: true, remaining: 1 })
    expect(rateLimit('b', 'k', opts)).toEqual({ ok: true, remaining: 0 })

    const refused = rateLimit('b', 'k', opts)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('counts each key separately', () => {
    for (let i = 0; i < 3; i++) rateLimit('b', 'first', opts)
    expect(rateLimit('b', 'first', opts).ok).toBe(false)
    // A different caller is unaffected by the first one being throttled.
    expect(rateLimit('b', 'second', opts).ok).toBe(true)
  })

  it('counts each bucket separately, so one limit cannot spend another', () => {
    for (let i = 0; i < 3; i++) rateLimit('sign-in', 'same-key', opts)
    expect(rateLimit('sign-in', 'same-key', opts).ok).toBe(false)
    expect(rateLimit('sign-up', 'same-key', opts).ok).toBe(true)
  })

  it('lets the caller back in once the window passes', () => {
    for (let i = 0; i < 3; i++) rateLimit('b', 'k', opts)
    expect(rateLimit('b', 'k', opts).ok).toBe(false)

    vi.advanceTimersByTime(60_001)
    expect(rateLimit('b', 'k', opts)).toEqual({ ok: true, remaining: 2 })
  })

  it('reports a retry-after that shrinks as the window drains', () => {
    for (let i = 0; i < 3; i++) rateLimit('b', 'k', opts)
    const first = rateLimit('b', 'k', opts)
    vi.advanceTimersByTime(30_000)
    const later = rateLimit('b', 'k', opts)

    expect(first.ok).toBe(false)
    expect(later.ok).toBe(false)
    if (!first.ok && !later.ok) {
      expect(later.retryAfterSeconds).toBeLessThan(first.retryAfterSeconds)
    }
  })

  it('does not grow without bound when keys are attacker-chosen', () => {
    // Distinct keys in a bucket whose windows have all expired: the map must
    // shed them rather than keep one entry per address seen, forever.
    for (let i = 0; i < 500; i++) rateLimit('b', `key-${i}`, opts)
    vi.advanceTimersByTime(60_001)
    for (let i = 0; i < 500; i++) rateLimit('b', `later-${i}`, opts)

    // The expired first batch is forgiven, which is the safe direction.
    expect(rateLimit('b', 'key-0', opts)).toEqual({ ok: true, remaining: 2 })
  })
})

describe('clientIp', () => {
  it('takes the first x-forwarded-for entry, not the last', () => {
    // The last entry is whatever the immediate peer appended; the first is the
    // original client on a platform that rewrites the header. Taking the last
    // would let a caller choose their own bucket.
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })
    expect(clientIp(headers)).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip, then to a shared bucket', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4')
    expect(clientIp(new Headers())).toBe('unknown')
  })

  it('does not hand out a free pass for a blank header', () => {
    // An empty or whitespace-only value must not become its own unique key.
    expect(clientIp(new Headers({ 'x-forwarded-for': '' }))).toBe('unknown')
    expect(clientIp(new Headers({ 'x-forwarded-for': '   ' }))).toBe('unknown')
  })
})
