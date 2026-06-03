'use client'

import { CopyButton } from './copy-button'
import { TokenBadge } from './token-badge'
import { AiDestinationLinks } from './ai-destination-links'
import { ContextMetaPanel } from './context-meta-panel'
import type { ContextMeta } from '@/lib/prompts/types'
import { cn } from '@/lib/utils'

export interface PromptResultPanelProps {
  text: string
  tokenCount: number
  contextMeta: ContextMeta
  defaultAi?: string | null
  className?: string
}

export function PromptResultPanel({
  text,
  tokenCount,
  contextMeta,
  defaultAi,
  className,
}: PromptResultPanelProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-background shadow-sm',
        className,
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
        <span className="text-sm font-medium text-foreground">Prompt Result</span>
        <div className="flex items-center gap-2">
          <TokenBadge count={tokenCount} />
          <CopyButton text={text} size="sm" />
        </div>
      </div>

      {/* ── Text block ─────────────────────────────────────────────────────── */}
      <pre className="m-0 max-h-[28rem] overflow-y-auto whitespace-pre-wrap break-words bg-muted/20 px-5 py-4 font-mono text-sm leading-relaxed text-foreground">
        {text}
      </pre>

      {/* ── Open in ────────────────────────────────────────────────────────── */}
      <div className="border-t border-border px-4 py-3">
        <AiDestinationLinks text={text} defaultAi={defaultAi} />
      </div>

      {/* ── What's included ────────────────────────────────────────────────── */}
      <ContextMetaPanel meta={contextMeta} />
    </div>
  )
}
