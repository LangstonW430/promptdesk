'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ShareLinkProps {
  publicToken: string
}

export function ShareLink({ publicToken }: ShareLinkProps) {
  const [copied, setCopied] = useState(false)
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/f/${publicToken}`

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Share link
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1 truncate rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm font-mono text-muted-foreground select-all">
          {url}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <a
          href={`/f/${publicToken}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <ExternalLink className="size-3.5" />
          Preview
        </a>
      </div>
    </div>
  )
}
