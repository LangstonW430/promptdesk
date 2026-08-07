'use client'

import { useEffect, useState } from 'react'
import {
  DARK_MEDIA_QUERY,
  DEFAULT_THEME,
  applyTheme,
  readStoredTheme,
  storeTheme,
  type Theme,
} from '@/lib/theme'

/**
 * Reads and writes the theme preference.
 *
 * `mounted` is false for the first render: the preference lives in
 * localStorage, which the server cannot read, so the initial markup has to
 * match what the server sent or hydration breaks. The pre-paint script in the
 * root layout has already applied the correct class by then, so nothing
 * flashes while this catches up — only a control reflecting the preference
 * needs to wait for it.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setThemeState(readStoredTheme())
    setMounted(true)
  }, [])

  // While following the OS, track it live — someone flipping their system
  // appearance should see this app change with everything else, no reload.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia(DARK_MEDIA_QUERY)
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  function setTheme(next: Theme) {
    setThemeState(next)
    storeTheme(next)
    applyTheme(next)
  }

  return { theme, setTheme, mounted }
}
