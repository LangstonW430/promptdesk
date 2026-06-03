'use client'

import { useState } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  BookOpen,
  Loader2,
  AlertCircle,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScopeBadge } from '@/components/dashboard/scope-badge'
import { CopyButton } from './copy-button'
import { TokenBadge } from './token-badge'
import { AiDestinationLinks } from './ai-destination-links'
import { PromptResultPanel } from './prompt-result-panel'
import { usePromptGenerator } from '@/lib/prompts/use-prompt-generator'
import { relativeTime } from '@/lib/dashboard/format'
import { cn } from '@/lib/utils'

export interface HistoryItem {
  id: string
  templateKey: string
  templateName: string
  scope: string
  clientId: string | null
  clientName: string | null
  renderedText: string
  tokenCount: number | null
  isSaved: boolean
  rating: 1 | -1 | null
  createdAt: string
}

type Expanded = { id: string; mode: 'open' | 'rerun' } | null

// ─── Stored prompt view (re-open, no live API call) ───────────────────────────

function StoredPromptView({
  text,
  tokenCount,
  defaultAi,
}: {
  text: string
  tokenCount: number | null
  defaultAi: string | null
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
        <span className="text-sm font-medium text-foreground">Stored Prompt</span>
        <div className="flex items-center gap-2">
          {tokenCount != null && <TokenBadge count={tokenCount} />}
          <CopyButton text={text} size="sm" />
        </div>
      </div>
      <pre className="m-0 max-h-64 overflow-y-auto whitespace-pre-wrap break-words bg-muted/20 px-5 py-4 font-mono text-sm leading-relaxed text-foreground">
        {text}
      </pre>
      <div className="border-t border-border px-4 py-3">
        <AiDestinationLinks text={text} defaultAi={defaultAi} />
      </div>
    </div>
  )
}

// ─── History list ─────────────────────────────────────────────────────────────

interface PromptHistoryListProps {
  history: HistoryItem[]
  defaultAi: string | null
}

export function PromptHistoryList({ history: initial, defaultAi }: PromptHistoryListProps) {
  const [items, setItems] = useState(initial)
  const [savedOnly, setSavedOnly] = useState(false)
  const [expanded, setExpanded] = useState<Expanded>(null)
  const { result, loading, error, generate, clear } = usePromptGenerator()

  const displayed = savedOnly ? items.filter((i) => i.isSaved) : items

  async function handleSave(id: string) {
    const res = await fetch(`/api/prompts/${id}/save`, { method: 'POST' })
    if (!res.ok) return
    const data = await res.json()
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isSaved: data.isSaved as boolean } : i)),
    )
  }

  async function handleRate(id: string, next: 1 | -1 | null) {
    const res = await fetch(`/api/prompts/${id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: next }),
    })
    if (!res.ok) return
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, rating: next } : i)))
  }

  function toggleRating(item: HistoryItem, value: 1 | -1) {
    handleRate(item.id, item.rating === value ? null : value)
  }

  function handleReopen(id: string) {
    if (expanded?.id === id && expanded.mode === 'open') {
      setExpanded(null)
      return
    }
    if (expanded?.mode === 'rerun') clear()
    setExpanded({ id, mode: 'open' })
  }

  function handleRerun(item: HistoryItem) {
    if (expanded?.id === item.id && expanded.mode === 'rerun') {
      setExpanded(null)
      clear()
      return
    }
    setExpanded({ id: item.id, mode: 'rerun' })
    generate({
      templateKey: item.templateKey,
      scope: item.scope as 'global' | 'client' | 'notes',
      clientId: item.clientId ?? undefined,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.length === 0 ? 'No prompts generated yet.' : `${items.length} prompt${items.length === 1 ? '' : 's'} generated`}
        </p>
        <Button
          size="xs"
          variant={savedOnly ? 'default' : 'outline'}
          onClick={() => setSavedOnly((v) => !v)}
        >
          <BookmarkCheck className="size-3" />
          Saved only
        </Button>
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <p className="rounded-xl border border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {savedOnly ? 'No saved prompts yet. Click 📌 on any prompt to pin it.' : 'No prompts generated yet — head to the Generate tab to create your first one.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {displayed.map((item, idx) => {
            const isExpanded = expanded?.id === item.id
            const isLast = idx === displayed.length - 1

            return (
              <div key={item.id}>
                {/* Row */}
                <div
                  className={cn(
                    'flex items-start gap-3 px-4 py-3',
                    !isLast && !isExpanded && 'border-b border-border',
                  )}
                >
                  {/* Info column */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{item.templateName}</span>
                      <ScopeBadge scope={item.scope} />
                      {item.clientName && (
                        <span className="text-xs text-muted-foreground">
                          · {item.clientName}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {item.tokenCount != null && <span>~{item.tokenCount.toLocaleString()} tokens</span>}
                      <span>·</span>
                      <span>{relativeTime(new Date(item.createdAt))}</span>
                      {item.isSaved && (
                        <>
                          <span>·</span>
                          <span className="text-primary">Saved</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {/* Re-open */}
                    <Button
                      size="xs"
                      variant={isExpanded && expanded?.mode === 'open' ? 'secondary' : 'outline'}
                      onClick={() => handleReopen(item.id)}
                      title="View stored prompt"
                    >
                      {isExpanded && expanded.mode === 'open' ? (
                        <ChevronUp className="size-3" />
                      ) : (
                        <BookOpen className="size-3" />
                      )}
                      Open
                    </Button>

                    {/* Re-run */}
                    <Button
                      size="xs"
                      variant={isExpanded && expanded?.mode === 'rerun' ? 'secondary' : 'outline'}
                      onClick={() => handleRerun(item)}
                      disabled={loading && expanded?.id === item.id}
                      title="Re-generate fresh prompt"
                    >
                      {loading && expanded?.id === item.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : isExpanded && expanded.mode === 'rerun' ? (
                        <ChevronUp className="size-3" />
                      ) : (
                        <RotateCcw className="size-3" />
                      )}
                      Re-run
                    </Button>

                    {/* Save / pin */}
                    <Button
                      size="icon-xs"
                      variant="outline"
                      onClick={() => handleSave(item.id)}
                      title={item.isSaved ? 'Unpin' : 'Pin / save'}
                      className={item.isSaved ? 'text-primary' : ''}
                    >
                      {item.isSaved ? (
                        <BookmarkCheck className="size-3.5" />
                      ) : (
                        <Bookmark className="size-3.5" />
                      )}
                    </Button>

                    {/* Thumbs up */}
                    <Button
                      size="icon-xs"
                      variant="outline"
                      onClick={() => toggleRating(item, 1)}
                      title="Thumbs up"
                      className={item.rating === 1 ? 'border-green-500 text-green-600 dark:text-green-400' : ''}
                    >
                      <ThumbsUp className="size-3.5" />
                    </Button>

                    {/* Thumbs down */}
                    <Button
                      size="icon-xs"
                      variant="outline"
                      onClick={() => toggleRating(item, -1)}
                      title="Thumbs down"
                      className={item.rating === -1 ? 'border-destructive text-destructive' : ''}
                    >
                      <ThumbsDown className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div
                    className={cn(
                      'border-t border-border px-4 pb-4 pt-3',
                      !isLast && 'border-b border-border',
                    )}
                  >
                    {expanded.mode === 'open' && (
                      <StoredPromptView
                        text={item.renderedText}
                        tokenCount={item.tokenCount}
                        defaultAi={defaultAi}
                      />
                    )}
                    {expanded.mode === 'rerun' && (
                      <>
                        {loading && (
                          <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            Generating fresh prompt…
                          </div>
                        )}
                        {error && (
                          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
                            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                            {error}
                          </div>
                        )}
                        {result && (
                          <PromptResultPanel
                            text={result.text}
                            tokenCount={result.tokenCount}
                            contextMeta={result.contextMeta}
                            defaultAi={defaultAi}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
