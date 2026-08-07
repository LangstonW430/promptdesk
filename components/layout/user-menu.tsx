'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { Menu } from '@base-ui/react/menu'
import { Settings, LogOut, Sun, Moon, Monitor, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/actions/auth'
import { useTheme } from '@/lib/use-theme'
import { THEMES, type Theme } from '@/lib/theme'

const THEME_META: Record<Theme, { label: string; icon: typeof Sun }> = {
  light: { label: 'Light', icon: Sun },
  dark: { label: 'Dark', icon: Moon },
  system: { label: 'System', icon: Monitor },
}

const itemClass = cn(
  'flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none',
  'data-highlighted:bg-muted data-highlighted:text-foreground',
)

interface UserMenuProps {
  email: string
}

/**
 * Account menu behind the avatar.
 *
 * The avatar was a plain <div> — it looked like a button, carried a tooltip,
 * and did nothing when clicked. Everything that lived loose in the topbar
 * (theme, sign out) now hangs off it, which is where people look for it and
 * leaves the bar with one control instead of three.
 *
 * Theme is a radio group here rather than the cycling button it replaces: all
 * three options are visible at once, so nobody has to click twice to discover
 * where "System" went.
 */
export function UserMenu({ email }: UserMenuProps) {
  const { theme, setTheme, mounted } = useTheme()
  const [isSigningOut, startSignOut] = useTransition()

  const initial = email?.[0]?.toUpperCase() ?? '?'

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Account menu"
        className={cn(
          'flex size-8 cursor-pointer items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary transition-colors outline-none',
          'hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring/50',
        )}
      >
        {initial}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Menu.Popup
            className={cn(
              'w-60 origin-(--transform-origin) rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none',
              'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
              'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            )}
          >
            {/* Who you are. The avatar's initial is ambiguous on its own, and
                this was previously only reachable as a title attribute. */}
            <div className="px-2 py-1.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Signed in as
              </p>
              <p className="truncate text-sm font-medium" title={email}>
                {email}
              </p>
            </div>

            <Menu.Separator className="-mx-1 my-1 h-px bg-border" />

            <Menu.Item
              className={itemClass}
              render={<Link href="/settings" />}
            >
              <Settings className="size-4 text-muted-foreground" />
              Settings
            </Menu.Item>

            <Menu.Separator className="-mx-1 my-1 h-px bg-border" />

            <Menu.GroupLabel className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Theme
            </Menu.GroupLabel>
            <Menu.RadioGroup
              value={theme}
              onValueChange={(next) => setTheme(next as Theme)}
            >
              {THEMES.map((t) => {
                const { label, icon: Icon } = THEME_META[t]
                return (
                  <Menu.RadioItem key={t} value={t} className={itemClass}>
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="flex-1">{label}</span>
                    {/* Until the stored preference has been read, showing a tick
                        would assert a choice that may be wrong for one frame. */}
                    {mounted && (
                      <Menu.RadioItemIndicator>
                        <Check className="size-3.5 text-muted-foreground" />
                      </Menu.RadioItemIndicator>
                    )}
                  </Menu.RadioItem>
                )
              })}
            </Menu.RadioGroup>

            <Menu.Separator className="-mx-1 my-1 h-px bg-border" />

            <Menu.Item
              className={cn(itemClass, 'text-destructive data-highlighted:text-destructive')}
              disabled={isSigningOut}
              onClick={() => startSignOut(async () => { await signOut() })}
            >
              {isSigningOut
                ? <Loader2 className="size-4 animate-spin" />
                : <LogOut className="size-4" />}
              Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
