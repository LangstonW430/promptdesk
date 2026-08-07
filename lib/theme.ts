/**
 * Theme preference: light, dark, or follow the OS.
 *
 * Hand-rolled rather than pulling in next-themes — the whole mechanism is the
 * three functions below plus one inline script, and a dependency that ships its
 * own provider and context is a lot of surface for that.
 *
 * The palette in globals.css hangs off a `.dark` class (`@custom-variant dark
 * (&:is(.dark *))`), so applying a theme means toggling exactly one class on
 * <html>. Nothing was ever toggling it, which is why the dark palette existed
 * but never rendered.
 */

export const THEMES = ['light', 'dark', 'system'] as const
export type Theme = (typeof THEMES)[number]

export const DEFAULT_THEME: Theme = 'system'

/** localStorage key. Shared with the pre-paint script, which is a string copy. */
export const THEME_STORAGE_KEY = 'promptdesk-theme'

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

/**
 * The theme actually rendered, given a preference and the OS setting.
 * `system` defers to the OS; anything unrecognised falls back to the default.
 */
export function resolveTheme(preference: unknown, prefersDark: boolean): 'light' | 'dark' {
  const theme = isTheme(preference) ? preference : DEFAULT_THEME
  if (theme === 'system') return prefersDark ? 'dark' : 'light'
  return theme
}

/** Reads the stored preference. Returns the default when absent or corrupt. */
export function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    // Private browsing and blocked-storage modes throw on access rather than
    // returning null. A theme preference is not worth breaking the page for.
    return DEFAULT_THEME
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Same as above — the class is still applied for this session.
  }
}

/** Applies a preference to <html> right now. */
export function applyTheme(theme: Theme): void {
  const prefersDark = window.matchMedia(DARK_MEDIA_QUERY).matches
  const resolved = resolveTheme(theme, prefersDark)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  // Lets the pre-paint script and anything reading the DOM tell "explicitly
  // light" from "system that resolved to light".
  document.documentElement.dataset.theme = theme
}

/**
 * Script that runs before first paint, inlined in <head>.
 *
 * Without it the server sends markup with no `dark` class and the browser
 * paints the light palette before React hydrates and corrects it — a white
 * flash on every single navigation for anyone using dark mode. It has to be
 * blocking and inline; anything deferred or bundled is already too late.
 *
 * Deliberately dependency-free and stringified: it executes before any bundle
 * has loaded, so it cannot import the helpers above. Keep the storage key in
 * sync with THEME_STORAGE_KEY.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var p=localStorage.getItem(k);
if(p!=='light'&&p!=='dark'&&p!=='system'){p=${JSON.stringify(DEFAULT_THEME)}}
var d=p==='dark'||(p==='system'&&window.matchMedia(${JSON.stringify(DARK_MEDIA_QUERY)}).matches);
document.documentElement.classList.toggle('dark',d);
document.documentElement.dataset.theme=p;
}catch(e){}})();
`.trim()
