'use client'

import { FileSearch, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PromptResultPanel } from './prompt-result-panel'
import { usePromptGenerator } from '@/lib/prompts/use-prompt-generator'

interface NoteAnalysisPanelProps {
  clientId: string
  noteCount: number
  defaultAi?: string | null
}

export function NoteAnalysisPanel({ clientId, noteCount, defaultAi }: NoteAnalysisPanelProps) {
  const { result, loading, error, generate } = usePromptGenerator()

  if (noteCount === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Summarise notes, extract action items, detect deadlines, and draft a follow-up.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            generate({ templateKey: 'note_analysis', scope: 'notes', clientId })
          }
          disabled={loading}
          className="shrink-0 gap-1.5"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FileSearch className="size-3.5" />
          )}
          {loading ? 'Generating…' : 'Copy Analysis Prompt'}
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
