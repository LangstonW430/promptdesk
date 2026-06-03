'use client'

import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AI_DESTINATIONS,
  AI_DESTINATION_ORDER,
  isValidAiKey,
} from '@/lib/prompts/ai-destinations'
import { cn } from '@/lib/utils'

async function silentCopy(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:absolute;left:-9999px;top:-9999px'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  } catch {
    // best-effort — user can still copy manually
  }
}

interface AiDestinationLinksProps {
  text: string
  defaultAi?: string | null
  className?: string
}

export function AiDestinationLinks({
  text,
  defaultAi,
  className,
}: AiDestinationLinksProps) {
  const primaryKey = isValidAiKey(defaultAi) ? defaultAi : null

  function handleOpen(url: string) {
    silentCopy(text)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="shrink-0 text-xs text-muted-foreground">Open in:</span>
      {AI_DESTINATION_ORDER.map((key) => {
        const dest = AI_DESTINATIONS[key]
        const isPrimary = key === primaryKey
        return (
          <Button
            key={key}
            variant={isPrimary ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleOpen(dest.url)}
            aria-label={`Copy prompt and open ${dest.label}`}
            className="gap-1"
          >
            {dest.label}
            <ExternalLink className="size-3 opacity-60" />
          </Button>
        )
      })}
    </div>
  )
}
