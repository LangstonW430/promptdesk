'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Menu } from '@base-ui/react/menu'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateProjectAction } from '@/lib/actions/projects'
import { PROJECT_STATUSES, projectStatusConfig } from './project-status-badge'

interface ProjectStatusSelectProps {
  projectId: string
  status: string
  className?: string
}

/**
 * The status badge, made editable in place.
 *
 * This was a transparent native `<select>` laid over the pill, which meant the
 * open list was drawn by the operating system: default fonts, square corners,
 * and a light popup even in dark mode. Base UI's Menu renders the list as real
 * DOM instead, so it takes the app's own popover tokens and matches every other
 * overlay here. Keyboard navigation, focus return and outside-click come from
 * the primitive rather than being reimplemented.
 *
 * A radio group rather than plain items: picking a status is a single choice
 * among a fixed set, and the selected one should be announced as such.
 */
export function ProjectStatusSelect({
  projectId,
  status,
  className,
}: ProjectStatusSelectProps) {
  const router = useRouter()
  const [value, setValue] = useState(status)
  const [isPending, startTransition] = useTransition()

  // Re-sync when the server sends a different status — someone edited it on the
  // detail page, or our own refresh landed.
  useEffect(() => { setValue(status) }, [status])

  const cfg = projectStatusConfig(value)

  function handleChange(next: string) {
    if (next === value) return
    const previous = value
    setValue(next)

    startTransition(async () => {
      const result = await updateProjectAction(projectId, { status: next })
      if ('error' in result) {
        setValue(previous)
        return
      }
      router.refresh()
    })
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={isPending}
        aria-label={`Status: ${cfg.label}. Change project status.`}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 rounded-full py-0.5 pl-2 pr-1.5 text-xs font-medium transition-opacity outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/50',
          cfg.className,
          isPending && 'cursor-wait opacity-60',
          className,
        )}
      >
        {cfg.label}
        <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Menu.Popup
            className={cn(
              'min-w-40 origin-(--transform-origin) rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none',
              'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
              'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            )}
          >
            <Menu.RadioGroup
              value={value}
              onValueChange={(next) => handleChange(String(next))}
            >
              {PROJECT_STATUSES.map((s) => {
                const item = projectStatusConfig(s)
                return (
                  <Menu.RadioItem
                    key={s}
                    value={s}
                    className={cn(
                      'flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none',
                      'data-highlighted:bg-muted data-highlighted:text-foreground',
                    )}
                  >
                    {/* Same dot the row uses, so the menu and the list read as
                        one vocabulary rather than two. */}
                    <span
                      className={cn('size-2 shrink-0 rounded-full', item.dotClassName)}
                      aria-hidden="true"
                    />
                    <span className="flex-1">{item.label}</span>
                    <Menu.RadioItemIndicator>
                      <Check className="size-3.5 text-muted-foreground" />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                )
              })}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
