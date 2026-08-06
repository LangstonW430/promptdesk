import { describe, it, expect } from 'vitest'
import {
  THEMES,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEME_INIT_SCRIPT,
  isTheme,
  resolveTheme,
  nextTheme,
} from '@/lib/theme'

describe('isTheme', () => {
  it('accepts the three known preferences', () => {
    for (const t of THEMES) expect(isTheme(t)).toBe(true)
  })

  it('rejects anything else', () => {
    for (const v of ['Dark', 'auto', '', null, undefined, 0, {}]) {
      expect(isTheme(v)).toBe(false)
    }
  })
})

describe('resolveTheme', () => {
  it('honours an explicit preference regardless of the OS', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('defers to the OS when following the system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('falls back to the default rather than throwing on corrupt storage', () => {
    // localStorage is user-writable, so this has to survive junk.
    expect(resolveTheme('purple', true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
    expect(DEFAULT_THEME).toBe('system')
  })
})

describe('nextTheme', () => {
  it('cycles light → dark → system → light', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
    expect(nextTheme('system')).toBe('light')
  })

  it('reaches every theme, so none is unreachable from the button', () => {
    const seen = new Set<string>()
    let t = DEFAULT_THEME
    for (let i = 0; i < THEMES.length; i++) {
      seen.add(t)
      t = nextTheme(t)
    }
    expect(seen).toEqual(new Set(THEMES))
    // and returns to where it started
    expect(t).toBe(DEFAULT_THEME)
  })

  it('recovers from an invalid current value', () => {
    expect(THEMES).toContain(nextTheme('nonsense'))
  })
})

describe('THEME_INIT_SCRIPT', () => {
  it('embeds the same storage key the helpers read', () => {
    // The script runs before any bundle loads and cannot import the constant,
    // so the two copies have to be checked against each other.
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY))
  })

  it('is self-contained — no identifiers a bundle would have to provide', () => {
    for (const forbidden of ['import', 'require', 'export']) {
      expect(THEME_INIT_SCRIPT).not.toContain(forbidden)
    }
  })

  it('swallows its own errors so blocked storage cannot break the page', () => {
    expect(THEME_INIT_SCRIPT).toContain('try')
    expect(THEME_INIT_SCRIPT).toContain('catch')
  })

  it('contains no closing script tag that would break the inline block', () => {
    expect(THEME_INIT_SCRIPT.toLowerCase()).not.toContain('</script')
  })
})
