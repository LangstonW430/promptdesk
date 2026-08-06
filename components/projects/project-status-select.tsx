'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateProjectAction } from '@/lib/actions/projects'
import {
  PROJECT_STATUSES,
  projectStatusConfig,
  type ProjectStatus,
} from './project-status-badge'

interface ProjectStatusSelectProps {
  projectId: string
  status: string
  /** Called with the new status once the server has accepted it. */
  onChanged?: (status: ProjectStatus) => void
  className?: string
}

/**
 * The status badge, made editable in place.
 *
 * Moving a project between proposed / active / on hold used to mean opening it
 * and going through the edit form — three navigations to change one field that
 * the row was already displaying. This keeps the badge's appearance so the list
 * reads the same at a glance, and layers a native `<select>` over it: native
 * because it is keyboard-operable and screen-reader-labelled for free, and
 * because on touch it opens the platform picker rather than a bespoke menu.
 */
export function ProjectStatusSelect({
  projectId,
  status,
  onChanged,
  className,
}: ProjectStatusSelectProps) {
  const router = useRouter()
  const [value, setValue] = useState(status)
  const [isPending, startTransition] = useTransition()

  // Re-sync when the server sends a different status (someone edited it on the
  // detail page, or our own refresh landed).
  useEffect(() => { setValue(status) }, [status])

  const cfg = projectStatusConfig(value)

  function handleChange(next: string) {
    const previous = value
    setValue(next)

    startTransition(async () => {
      const result = await updateProjectAction(projectId, { status: next })
      if ('error' in result) {
        setValue(previous)
        return
      }
      onChanged?.(next as ProjectStatus)
      router.refresh()
    })
  }

  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1.5 text-xs font-medium transition-opacity',
        // The transparent <select> takes focus, so the ring has to come from
        // the wrapper for the pill to look focused at all.
        'focus-within:ring-2 focus-within:ring-ring/50',
        cfg.className,
        isPending && 'opacity-60',
        className,
      )}
    >
      {cfg.label}
      <ChevronDown className="size-3 opacity-60" aria-hidden="true" />

      {/* The real control, laid transparently over the pill so the pill itself
          is the hit target. `inset-0` keeps that target the full size of the
          badge rather than a chevron-sized sliver. */}
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Project status"
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {projectStatusConfig(s).label}
          </option>
        ))}
      </select>
    </span>
  )
}
