'use client'

import { useState } from 'react'
import { ExternalLink, Mail, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AI_DESTINATIONS,
  AI_DESTINATION_ORDER,
  isValidAiKey,
  buildGmailUrl,
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
  /** When provided, a Gmail compose button appears pre-addressed to this email. */
  gmailTo?: string | null
  className?: string
}

export function AiDestinationLinks({
  text,
  defaultAi,
  gmailTo,
  className,
}: AiDestinationLinksProps) {
  const primaryKey = isValidAiKey(defaultAi) ? defaultAi : null
  const [gmailCopied, setGmailCopied] = useState(false)

  function handleOpen(url: string) {
    silentCopy(text)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleGmail() {
    silentCopy(text)
    setGmailCopied(true)
    setTimeout(() => setGmailCopied(false), 2500)
    window.open(buildGmailUrl(gmailTo ?? undefined), '_blank', 'noopener,noreferrer')
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

      {/* Gmail compose button — only shown when gmailTo is supplied */}
      {gmailTo && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleGmail}
          aria-label={`Copy email draft and open Gmail compose${gmailTo ? ` to ${gmailTo}` : ''}`}
          className="gap-1"
        >
          {gmailCopied ? (
            <Check className="size-3 text-green-600" />
          ) : (
            <Mail className="size-3 opacity-60" />
          )}
          {gmailCopied ? 'Copied!' : 'Gmail'}
          {!gmailCopied && <ExternalLink className="size-3 opacity-60" />}
        </Button>
      )}
    </div>
  )
}
