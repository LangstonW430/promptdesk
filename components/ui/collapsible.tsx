'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleProps {
  title: string
  description?: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

function Collapsible({
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: CollapsibleProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const id = React.useId()

  return (
    <div className={cn('rounded-lg border border-border', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors rounded-lg"
      >
        <div>
          <p className="text-sm font-medium">{title}</p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <div
        id={id}
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

export { Collapsible }
