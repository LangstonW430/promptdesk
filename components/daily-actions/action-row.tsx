'use client'

import { useState } from 'react'
import { Sparkles, Loader2, CheckCircle2, AlertCircle, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StageBadge } from '@/components/clients/stage-badge'
import { PromptResultPanel } from '@/components/prompts/prompt-result-panel'
import { CompleteFollowUpSheet } from '@/components/daily-actions/complete-followup-sheet'
import { usePromptGenerator } from '@/lib/prompts/use-prompt-generator'
import type { ActionClient } from '@/lib/daily-actions'
import { cn } from '@/lib/utils'

type QueueType = 'overdue' | 'hot' | 'cold'

const DOT_COLORS: Record<QueueType, string> = {
  overdue: 'bg-red-500',
  hot: 'bg-amber-500',
  cold: 'bg-sky-400',
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `$${Math.round(v / 1_000)}k`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}

function contextString(client: ActionClient, queue: QueueType): string {
  if (queue === 'overdue') {
    const d = client.daysOverdue ?? 0
    return d === 1 ? '1 day overdue' : `${d} days overdue`
  }
  if (queue === 'hot') {
    const parts: string[] = []
    if (client.pipelineValue) parts.push(formatValue(client.pipelineValue))
    if (client.daysSinceContact != null) {
      parts.push(
        client.daysSinceContact === 0
          ? 'contacted today'
          : `last contact ${client.daysSinceContact}d ago`,
      )
    }
    return parts.join(' · ') || 'High-value lead'
  }
  // cold
  const d = client.daysSinceContact ?? 30
  return d === 0
    ? 'No recent contact'
    : client.lastContactDate
      ? `Last contact ${d} days ago`
      : `No contact recorded (${d}d since created)`
}

interface ActionRowProps {
  client: ActionClient
  queueType: QueueType
  defaultAi: string | null
  isLast: boolean
}

export function ActionRow({ client, queueType, defaultAi, isLast }: ActionRowProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showOutreach, setShowOutreach] = useState(false)
  const { result, loading, error, generate, clear } = usePromptGenerator()

  function handleOutreach() {
    if (showOutreach) {
      setShowOutreach(false)
      clear()
      return
    }
    setShowOutreach(true)
    generate({
      templateKey: 'follow_up_recommendations',
      scope: 'client',
      clientId: client.id,
    })
  }

  const ctx = contextString(client, queueType)

  return (
    <>
      <div
        className={cn(
          'flex items-start gap-3 px-4 py-3',
          !isLast && !showOutreach && 'border-b border-border',
        )}
      >
        {/* Queue colour dot */}
        <span
          className={cn(
            'mt-[5px] size-2 shrink-0 rounded-full',
            DOT_COLORS[queueType],
          )}
        />

        {/* Name + context */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{client.displayName}</span>
            <StageBadge stage={client.stage} />
            {client.pipelineValue != null && queueType !== 'hot' && (
              <span className="text-xs text-muted-foreground">
                {formatValue(client.pipelineValue)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{ctx}</p>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSheetOpen(true)}
          >
            <CheckCircle2 className="size-3.5 text-green-600" />
            Complete
          </Button>
          <Button
            size="sm"
            variant={showOutreach ? 'secondary' : 'outline'}
            onClick={handleOutreach}
            disabled={loading}
            aria-expanded={showOutreach}
          >
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : showOutreach ? (
              <ChevronUp className="size-3" />
            ) : (
              <Sparkles className="size-3" />
            )}
            {showOutreach ? 'Close' : 'Outreach'}
          </Button>
        </div>
      </div>

      {/* Inline outreach prompt panel */}
      {showOutreach && (
        <div
          className={cn(
            'px-4 pb-3',
            !isLast && 'border-b border-border',
          )}
        >
          {loading && (
            <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Generating outreach prompt…
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
        </div>
      )}

      {/* Complete + schedule sheet */}
      <CompleteFollowUpSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        clientId={client.id}
        clientName={client.displayName}
      />
    </>
  )
}
