'use client'

import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PromptResultPanel } from './prompt-result-panel'
import { usePromptGenerator } from '@/lib/prompts/use-prompt-generator'

interface ClientInsightPanelProps {
  clientId: string
  defaultAi?: string | null
}

export function ClientInsightPanel({ clientId, defaultAi }: ClientInsightPanelProps) {
  const { result, loading, error, generate } = usePromptGenerator()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Health assessment, conversion probability, recommended next actions, likely
          objections, upsell opportunities, and a relationship briefing.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            generate({ templateKey: 'client_insight', scope: 'client', clientId })
          }
          disabled={loading}
          className="shrink-0 gap-1.5"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {loading ? 'Generating…' : 'Generate Prompt'}
        </Button>
      </div>

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
  )
}
