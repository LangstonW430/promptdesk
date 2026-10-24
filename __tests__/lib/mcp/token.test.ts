import { describe, it, expect } from 'vitest'
import {
  TOKEN_PREFIX,
  generateToken,
  hashToken,
  isWellFormedToken,
  parseBearer,
} from '@/lib/mcp/token'

describe('generateToken', () => {
  it('prefixes the token so a leaked one is recognisable', () => {
    expect(generateToken().plaintext.startsWith(TOKEN_PREFIX)).toBe(true)
  })

  it('produces a token its own format check accepts', () => {
    expect(isWellFormedToken(generateToken().plaintext)).toBe(true)
  })

  it('never repeats', () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => generateToken().plaintext),
    )
    expect(seen.size).toBe(500)
  })

  it('returns the hash of the plaintext it returns', () => {
    const { plaintext, hash } = generateToken()
    expect(hash).toBe(hashToken(plaintext))
  })

  /**
   * The hint is shown in the settings list, so it must not be enough to
   * reconstruct the token — and it must genuinely be a prefix of it, or it
   * would identify the wrong row to whoever is comparing.
   */
  it('hints with a short, non-secret prefix', () => {
    const { plaintext, hint } = generateToken()
    expect(plaintext.startsWith(hint)).toBe(true)
    expect(hint.length).toBeLessThan(plaintext.length / 2)
  })
})

describe('hashToken', () => {
  it('is a stable 64-character hex digest', () => {
    const hash = hashToken('pd_live_whatever')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken('pd_live_whatever')).toBe(hash)
  })

  it('separates tokens that differ by one character', () => {
    expect(hashToken('pd_live_a')).not.toBe(hashToken('pd_live_b'))
  })
})

describe('isWellFormedToken', () => {
  it('rejects anything not shaped like a minted token', () => {
    for (const bad of [
      '',
      'pd_live_',
      'pd_live_short',
      'nope_' + 'a'.repeat(43),
      TOKEN_PREFIX + 'a'.repeat(42),
      TOKEN_PREFIX + 'a'.repeat(44),
      // base64url excludes '+' and '/'
      TOKEN_PREFIX + '+'.repeat(43),
    ]) {
      expect(isWellFormedToken(bad)).toBe(false)
    }
  })
})

describe('parseBearer', () => {
  it('reads the token out of a well-formed header', () => {
    expect(parseBearer('Bearer pd_live_abc')).toBe('pd_live_abc')
  })

  it('accepts the scheme in any case, as RFC 7235 requires', () => {
    expect(parseBearer('bearer pd_live_abc')).toBe('pd_live_abc')
    expect(parseBearer('BEARER pd_live_abc')).toBe('pd_live_abc')
  })

  it('returns null rather than throwing for anything else', () => {
    expect(parseBearer(null)).toBeNull()
    expect(parseBearer(undefined)).toBeNull()
    expect(parseBearer('')).toBeNull()
    expect(parseBearer('pd_live_abc')).toBeNull()
    expect(parseBearer('Basic dXNlcjpwYXNz')).toBeNull()
    expect(parseBearer('Bearer')).toBeNull()
    expect(parseBearer('Bearer a b')).toBeNull()
  })

  /**
   * The bound exists so an abusive header cannot cost a sha-256 and a database
   * round trip. Without it, the only limit is whatever the platform accepts.
   */
  it('refuses a header far longer than any real token', () => {
    expect(parseBearer('Bearer ' + 'a'.repeat(10_000))).toBeNull()
  })
})
