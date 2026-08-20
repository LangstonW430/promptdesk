import { describe, it, expect } from 'vitest'
import { safeNextPath } from '@/lib/safe-redirect'

/**
 * The two call sites use the result differently — one concatenates it onto an
 * origin, the other hands it to `redirect()` — so the property being asserted
 * is the one both rely on: whatever comes back, resolving it against our origin
 * cannot land on another host.
 */
function hostAfterRedirect(next: unknown): string {
  const origin = 'https://app.example.com'
  return new URL(origin + safeNextPath(next)).host
}

describe('safeNextPath', () => {
  it('keeps ordinary in-app paths', () => {
    expect(safeNextPath('/clients')).toBe('/clients')
    expect(safeNextPath('/invoices/abc-123')).toBe('/invoices/abc-123')
    expect(safeNextPath('/clients?archived=true')).toBe('/clients?archived=true')
    expect(safeNextPath('/settings#stripe')).toBe('/settings#stripe')
  })

  it('falls back when there is nothing usable', () => {
    expect(safeNextPath(undefined)).toBe('/dashboard')
    expect(safeNextPath(null)).toBe('/dashboard')
    expect(safeNextPath('')).toBe('/dashboard')
    expect(safeNextPath(42)).toBe('/dashboard')
    expect(safeNextPath({ toString: () => '/clients' })).toBe('/dashboard')
  })

  it('honours a caller-supplied fallback', () => {
    expect(safeNextPath('https://evil.com', '/login')).toBe('/login')
  })

  // The exact strings that worked against the two call sites before the fix.
  it.each([
    ['@evil.com', 'userinfo — origin + this resolves to host evil.com'],
    ['.evil.com', 'suffix — becomes app.example.com.evil.com'],
    ['.evil.com/phish', 'suffix with a path'],
    ['//evil.com', 'protocol-relative — passes startsWith("/")'],
    ['///evil.com', 'three slashes'],
    ['/\\evil.com', 'backslash, normalised to // in the authority'],
    ['/\\/evil.com', 'mixed slash and backslash'],
    ['https://evil.com', 'absolute URL'],
    ['http://evil.com', 'absolute URL, other scheme'],
    ['javascript:alert(1)', 'script scheme'],
    ['data:text/html,<script>alert(1)</script>', 'data scheme'],
    ['dashboard', 'bare relative path — could resolve anywhere'],
  ])('refuses %s (%s)', (next) => {
    expect(safeNextPath(next)).toBe('/dashboard')
    expect(hostAfterRedirect(next)).toBe('app.example.com')
  })

  it('refuses control characters, including a Location-splitting newline', () => {
    expect(safeNextPath('/dash\nboard')).toBe('/dashboard')
    expect(safeNextPath('/\r\nSet-Cookie: a=b')).toBe('/dashboard')
    expect(safeNextPath('/\tevil')).toBe('/dashboard')
    expect(safeNextPath('/\u0000evil')).toBe('/dashboard')
    // A tab inside `//` is stripped by the URL parser, which would otherwise
    // turn a value that looked like a path into a protocol-relative one.
    expect(safeNextPath('/\t/evil.com')).toBe('/dashboard')
    expect(hostAfterRedirect('/\t/evil.com')).toBe('app.example.com')
  })

  it('never returns something that can change the host', () => {
    const attempts = [
      '@evil.com',
      '.evil.com',
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      '/redirect?to=https://evil.com',
      '/path/../../evil',
      '//evil.com/%2e%2e',
      '/\t/evil.com',
    ]
    for (const attempt of attempts) {
      const result = safeNextPath(attempt)
      expect(result.startsWith('/')).toBe(true)
      expect(result.startsWith('//')).toBe(false)
      expect(hostAfterRedirect(attempt)).toBe('app.example.com')
    }
  })
})
