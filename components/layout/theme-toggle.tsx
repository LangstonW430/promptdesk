'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DARK_MEDIA_QUERY,
  DEFAULT_THEME,
  applyTheme,
  nextTheme,
  readStoredTheme,
  storeTheme,
  type Theme,
} from '@/lib/theme'

const ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

const LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  const [mounted, setMounted] = useState(false)

  // The stored preference only exists in the browser, so the server cannot
  // render the right icon. Reading it after mount keeps the markup identical on
  // both sides; the pre-paint script has already applied the class itself, so
  // nothing flashes while this catches up.
  useEffect(() => {
    setTheme(readStoredTheme())
    setMounted(true)
  }, [])

  // While following the OS, track it live — someone flipping their system
  // appearance should see this app change with everything else, without a
  // reload.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia(DARK_MEDIA_QUERY)
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  function cycle() {
    const next = nextTheme(theme)
    setTheme(next)
    storeTheme(next)
    applyTheme(next)
  }

  const Icon = ICONS[theme]
  const upcoming = nextTheme(theme)

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={cycle}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      // Announces the state, not just the action — a toggle that only says
      // "switch to dark" leaves a screen-reader user unable to tell what it is
      // currently set to.
      aria-label={`Theme: ${LABELS[theme]}. Switch to ${LABELS[upcoming]}.`}
      title={`Theme: ${LABELS[theme]} — click for ${LABELS[upcoming]}`}
    >
      {/* Until mounted the icon is a guess, so hide it from assistive tech
          rather than announcing a theme that may be wrong for one frame. */}
      <Icon className="h-4 w-4" aria-hidden={!mounted} />
    </Button>
  )
}
