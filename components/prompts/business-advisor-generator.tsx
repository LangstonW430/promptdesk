'use client'

import { useState } from 'react'
import { Sparkles, Loader2, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PromptResultPanel } from './prompt-result-panel'
import { usePromptGenerator } from '@/lib/prompts/use-prompt-generator'
import { cn } from '@/lib/utils'

const SUGGESTED_OBJECTIVES = [
  'Which leads are most likely to convert?',
  'Which clients haven\'t been contacted recently?',
  'What are my top revenue opportunities this month?',
  'Which deals are at risk of stalling?',
  'How should I prioritise my pipeline this week?',
  'Which clients should I follow up with today?',
] as const

interface BusinessAdvisorGeneratorProps {
  defaultAi?: string | null
}

export function BusinessAdvisorGenerator({ defaultAi }: BusinessAdvisorGeneratorProps) {
  const [objective, setObjective] = useState('')
  const { result, loading, error, generate, clear } = usePromptGenerator()

  function selectChip(text: string) {
    setObjective((prev) => (prev === text ? '' : text))
    clear()
  }

  async function handleGenerate() {
    if (!objective.trim()) return
    await generate({
      templateKey: 'business_advisor',
      scope: 'global',
      objective: objective.trim(),
    })
  }

  function handleClear() {
    setObjective('')
    clear()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Objective chips */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_OBJECTIVES.map((obj) => (
          <button
            key={obj}
            type="button"
            onClick={() => selectChip(obj)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              objective === obj
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground',
            )}
          >
            {obj}
          </button>
        ))}
      </div>

      {/* Free-text input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={objective}
            onChange={(e) => { setObjective(e.target.value); if (result) clear() }}
            onKeyDown={(e) => { if (e.key === 'Enter' && objective.trim()) handleGenerate() }}
            placeholder="Or describe your own objective…"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 pr-8 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Objective"
          />
          {objective && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear objective"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button
          onClick={handleGenerate}
          disabled={!objective.trim() || loading}
          className="gap-1.5 shrink-0"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Generate
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
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
