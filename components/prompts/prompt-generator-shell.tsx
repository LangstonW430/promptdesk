'use client'

import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PromptResultPanel } from './prompt-result-panel'
import type { GenerateResult } from '@/lib/prompts/types'

interface PromptGeneratorShellProps {
  defaultAi?: string | null
}

export function PromptGeneratorShell({ defaultAi }: PromptGeneratorShellProps) {
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate(templateKey: string, scope: 'global' | 'client' | 'notes') {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_key: templateKey, scope }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate prompt')
        return
      }
      setResult({
        text: data.text,
        tokenCount: data.token_count,
        contextMeta: data.context_meta,
      })
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Generator cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <GeneratorCard
          title="Business Action Plan"
          description="Full pipeline review: priority deals, 7-day schedule, and personalised outreach drafts."
          onGenerate={() => generate('business_action_plan', 'global')}
          loading={loading}
        />
        <GeneratorCard
          title="Business Advisor"
          description="Ask a specific question about your pipeline and get a focused, data-driven answer."
          onGenerate={() => generate('business_advisor', 'global')}
          loading={loading}
          disabled
          disabledReason="Set an objective to use this generator"
        />
        <GeneratorCard
          title="Weekly Planning"
          description="Build a focused, realistic week around your highest-value deals and due tasks."
          onGenerate={() => generate('weekly_planning', 'global')}
          loading={loading}
        />
        <GeneratorCard
          title="Follow-Up Recommendations"
          description="See who to contact today, with personalised outreach message drafts."
          onGenerate={() => generate('follow_up_recommendations', 'global')}
          loading={loading}
        />
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

// ─── Generator card ───────────────────────────────────────────────────────────

interface GeneratorCardProps {
  title: string
  description: string
  onGenerate: () => void
  loading?: boolean
  disabled?: boolean
  disabledReason?: string
}

function GeneratorCard({
  title,
  description,
  onGenerate,
  loading,
  disabled,
  disabledReason,
}: GeneratorCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex-1">
        <p className="font-medium text-sm">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onGenerate}
        disabled={loading || disabled}
        className="self-start gap-1.5"
        title={disabled ? disabledReason : undefined}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        Generate
      </Button>
    </div>
  )
}
